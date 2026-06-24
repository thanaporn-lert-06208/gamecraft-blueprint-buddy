export type PrimitiveType = "string" | "int" | "float" | "bool";
export const PRIMITIVE_TYPES: PrimitiveType[] = ["string", "int", "float", "bool"];

export type FieldType =
  | { kind: "primitive"; type: PrimitiveType }
  | { kind: "class"; classId: string };

export interface ClassField {
  id: string;
  name: string;
  type: FieldType;
  isList: boolean;
}

export interface ClassObject {
  id: string;
  name: string;
  parentId: string | null;
  fields: ClassField[];
}

export interface Card {
  id: string;
  name: string;
  classId: string;
  data: Record<string, unknown>;
}

export interface GameFlowState {
  classes: ClassObject[];
  cards: Card[];
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

export function defaultValueFor(field: ClassField, classes: ClassObject[]): unknown {
  if (field.isList) return [];
  if (field.type.kind === "primitive") {
    switch (field.type.type) {
      case "string": return "";
      case "int":
      case "float": return 0;
      case "bool": return false;
    }
  }
  return makeEmptyObject(classes, field.type.classId);
}

export function makeEmptyObject(classes: ClassObject[], classId: string): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const f of getAllFields(classes, classId)) {
    obj[f.name] = defaultValueFor(f, classes);
  }
  return obj;
}

export function classToCSharp(cls: ClassObject, classes: ClassObject[]): string {
  const parent = cls.parentId ? classes.find((c) => c.id === cls.parentId) : null;
  const parentStr = parent ? ` : ${parent.name}` : "";
  const fieldLines = cls.fields.map((f) => {
    let baseType: string;
    if (f.type.kind === "primitive") {
      baseType = f.type.type;
    } else {
      baseType = classes.find((c) => c.id === f.type.classId)?.name ?? "object";
    }
    const t = f.isList ? `List<${baseType}>` : baseType;
    return `    public ${t} ${f.name};`;
  });
  return `public class ${cls.name}${parentStr}\n{\n${fieldLines.join("\n")}\n}`;
}
