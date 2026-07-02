export type PrimitiveType = "string" | "int" | "float" | "bool";
export const PRIMITIVE_TYPES: PrimitiveType[] = ["string", "int", "float", "bool"];

export type FieldType =
  | { kind: "primitive"; type: PrimitiveType }
  | { kind: "class"; classId: string }
  | { kind: "enum"; enumId: string };

export interface ClassField {
  id: string;
  name: string;
  type: FieldType;
  isList: boolean;
}

export interface ClassObject {
  id: string;
  name: string;
  label?: string;
  parentId: string | null;
  fields: ClassField[];
}

export interface ExportSettings {
  includeLabelInFilename: boolean;
  separator: string;
  jsonExtension: string;
  txtExtension: string;
}

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  includeLabelInFilename: false,
  separator: "_",
  jsonExtension: ".json",
  txtExtension: ".txt",
};

export interface EnumValue {
  id: string;
  name: string;
  /** When set, locks the numeric value (C# `Name = value`). When null/undefined, value auto-increments. */
  value?: number | null;
}

export interface EnumObject {
  id: string;
  name: string;
  values: EnumValue[];
}

/** Compute resolved numeric values for an enum, mirroring C# auto-increment rules. */
export function computeEnumNumbers(en: EnumObject): number[] {
  const out: number[] = [];
  let next = 0;
  for (const v of en.values) {
    if (v.value != null && Number.isFinite(v.value)) {
      next = Math.trunc(v.value);
    }
    out.push(next);
    next += 1;
  }
  return out;
}

export interface Card {
  id: string;
  name: string;
  classId: string;
  data: Record<string, unknown>;
  folderId?: string | null;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
}

export interface GameFlowState {
  classes: ClassObject[];
  enums: EnumObject[];
  cards: Card[];
  folders: Folder[];
  settings: ExportSettings;
}

/** Return folder id path from root -> folder (inclusive). */
export function getFolderPath(folders: Folder[], folderId: string | null | undefined): Folder[] {
  const out: Folder[] = [];
  let cur = folderId ? folders.find((f) => f.id === folderId) : undefined;
  const guard = new Set<string>();
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    out.unshift(cur);
    cur = cur.parentId ? folders.find((f) => f.id === cur!.parentId) : undefined;
  }
  return out;
}

/** All descendant folder ids of the given folder (not inclusive). */
export function getFolderDescendantIds(folders: Folder[], folderId: string): Set<string> {
  const out = new Set<string>();
  const stack = [folderId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const f of folders) {
      if (f.parentId === id && !out.has(f.id)) {
        out.add(f.id);
        stack.push(f.id);
      }
    }
  }
  return out;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function getAllFields(classes: ClassObject[], classId: string): ClassField[] {
  const cls = classes.find((c) => c.id === classId);
  if (!cls) return [];
  const parentFields = cls.parentId ? getAllFields(classes, cls.parentId) : [];
  return [...parentFields, ...cls.fields];
}

export function getAncestorIds(classes: ClassObject[], classId: string): Set<string> {
  const set = new Set<string>();
  let cur = classes.find((c) => c.id === classId);
  while (cur?.parentId) {
    set.add(cur.parentId);
    cur = classes.find((c) => c.id === cur!.parentId);
  }
  return set;
}

export function getDescendantIds(classes: ClassObject[], classId: string): Set<string> {
  const set = new Set<string>();
  const stack = [classId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const c of classes) {
      if (c.parentId === id && !set.has(c.id)) {
        set.add(c.id);
        stack.push(c.id);
      }
    }
  }
  return set;
}

export function defaultValueFor(
  field: ClassField,
  classes: ClassObject[],
  enums: EnumObject[] = [],
): unknown {
  if (field.isList) return [];
  const ft = field.type;
  if (ft.kind === "primitive") {
    switch (ft.type) {
      case "string": return "";
      case "int":
      case "float": return 0;
      case "bool": return false;
    }
  }
  if (ft.kind === "enum") {
    const en = enums.find((e) => e.id === ft.enumId);
    return en?.values[0]?.name ?? "";
  }
  // class: default null to safely support self/recursive references
  return null;
}

export function makeEmptyObject(
  classes: ClassObject[],
  classId: string,
  enums: EnumObject[] = [],
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const f of getAllFields(classes, classId)) {
    obj[f.name] = defaultValueFor(f, classes, enums);
  }
  return obj;
}

export function classToCSharp(
  cls: ClassObject,
  classes: ClassObject[],
  enums: EnumObject[] = [],
): string {
  const parent = cls.parentId ? classes.find((c) => c.id === cls.parentId) : null;
  const parentStr = parent ? ` : ${parent.name}` : "";
  const fieldLines = cls.fields.map((f) => {
    const ft = f.type;
    let baseType: string;
    if (ft.kind === "primitive") {
      baseType = ft.type;
    } else if (ft.kind === "enum") {
      baseType = enums.find((e) => e.id === ft.enumId)?.name ?? "object";
    } else {
      baseType = classes.find((c) => c.id === ft.classId)?.name ?? "object";
    }
    const t = f.isList ? `List<${baseType}>` : baseType;
    return `    public ${t} ${f.name};`;
  });
  return `public class ${cls.name}${parentStr}\n{\n${fieldLines.join("\n")}\n}`;
}

export function enumToCSharp(en: EnumObject): string {
  const lines = en.values.map((v) => {
    const suffix = v.value != null && Number.isFinite(v.value) ? ` = ${Math.trunc(v.value)}` : "";
    return `    ${v.name}${suffix},`;
  });
  return `public enum ${en.name}\n{\n${lines.join("\n")}\n}`;
}
