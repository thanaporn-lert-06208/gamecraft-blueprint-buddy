import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { actions, useGameFlow } from "@/lib/gameflow-store";
import {
  classToCSharp,
  getAllFields,
  getDescendantIds,
  PRIMITIVE_TYPES,
  uid,
  type ClassObject,
  type EnumObject,
  type FieldType,
  type PrimitiveType,
} from "@/lib/gameflow-types";
import { Plus, Trash2, Boxes } from "lucide-react";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/classes")({
  head: () => ({
    meta: [
      { title: "Class Builder — GameFlow Forge" },
      { name: "description", content: "Create C#-style class objects with fields, inheritance, nested and self references." },
    ],
  }),
  component: ClassesPage,
});

function ClassesPage() {
  const { classes } = useGameFlow();
  const { t: tr } = useLang();
  const [selectedId, setSelectedId] = useState<string | null>(classes[0]?.id ?? null);

  const selected = classes.find((c) => c.id === selectedId) ?? null;

  function createClass() {
    const cls: ClassObject = {
      id: uid(),
      name: `NewClass${classes.length + 1}`,
      parentId: null,
      fields: [],
    };
    actions.addClass(cls);
    setSelectedId(cls.id);
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{tr.classes_header}</h2>
            <Button size="sm" onClick={createClass}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="space-y-1">
            {classes.length === 0 && (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                {tr.classes_empty}
              </p>
            )}
            {classes.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
                  selectedId === c.id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"
                }`}
              >
                <Boxes className="h-4 w-4" />
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
        </aside>

        <section>
          {selected ? (
            <ClassEditor key={selected.id} cls={selected} onDelete={() => {
              actions.deleteClass(selected.id);
              setSelectedId(null);
            }} />
          ) : (
            <div className="grid h-64 place-items-center rounded-xl border border-dashed text-muted-foreground">
              {tr.select_or_create_class}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function typeName(t: FieldType, classes: ClassObject[], enums: EnumObject[]): string {
  if (t.kind === "primitive") return t.type;
  if (t.kind === "enum") return enums.find((e) => e.id === t.enumId)?.name ?? "?";
  return classes.find((c) => c.id === t.classId)?.name ?? "?";
}

function ClassEditor({ cls, onDelete }: { cls: ClassObject; onDelete: () => void }) {
  const { classes, enums } = useGameFlow();
  const { t: tr } = useLang();

  const forbiddenParents = useMemo(() => {
    const d = getDescendantIds(classes, cls.id);
    d.add(cls.id);
    return d;
  }, [classes, cls.id]);

  const parentOptions = classes.filter((c) => !forbiddenParents.has(c.id));

  const inheritedFields = cls.parentId ? getAllFields(classes, cls.parentId) : [];

  function updateField(fid: string, patch: Partial<typeof cls.fields[number]>) {
    actions.updateClass(cls.id, {
      fields: cls.fields.map((f) => (f.id === fid ? { ...f, ...patch } : f)),
    });
  }

  function addField() {
    actions.updateClass(cls.id, {
      fields: [
        ...cls.fields,
        {
          id: uid(),
          name: `field${cls.fields.length + 1}`,
          type: { kind: "primitive", type: "string" },
          isList: false,
        },
      ],
    });
  }

  function setFieldType(fid: string, value: string) {
    let next: FieldType;
    if (PRIMITIVE_TYPES.includes(value as PrimitiveType)) {
      next = { kind: "primitive", type: value as PrimitiveType };
    } else if (value.startsWith("class:")) {
      next = { kind: "class", classId: value.slice("class:".length) };
    } else {
      next = { kind: "enum", enumId: value.slice("enum:".length) };
    }
    updateField(fid, { type: next });
  }

  function fieldTypeValue(t: FieldType): string {
    if (t.kind === "primitive") return t.type;
    if (t.kind === "enum") return `enum:${t.enumId}`;
    return `class:${t.classId}`;
  }

  const csharp = classToCSharp(cls, classes, enums);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-5">
        <div className="grow space-y-2">
          <Label>{tr.class_name}</Label>
          <Input
            value={cls.name}
            onChange={(e) => actions.updateClass(cls.id, { name: e.target.value })}
            className="text-lg font-medium"
          />
        </div>
        <div className="w-64 space-y-2">
          <Label>{tr.inherits_from}</Label>
          <Select
            value={cls.parentId ?? "__none"}
            onValueChange={(v) => actions.updateClass(cls.id, { parentId: v === "__none" ? null : v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">{tr.none}</SelectItem>
              {parentOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" /> {tr.delete}
        </Button>
      </div>

      {inheritedFields.length > 0 && (
        <div className="rounded-xl border bg-muted/30 p-5">
          <h3 className="text-sm font-semibold text-muted-foreground">{tr.inherited_fields}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {inheritedFields.map((f) => (
              <span key={f.id} className="rounded-md border bg-background px-2 py-1 font-mono text-xs">
                {f.name}: {typeName(f.type, classes, enums)}{f.isList ? "[]" : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{tr.fields}</h3>
          <Button size="sm" onClick={addField}><Plus className="h-4 w-4" /> {tr.add_field}</Button>
        </div>
        <div className="mt-4 space-y-2">
          {cls.fields.length === 0 && (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              {tr.no_fields}
            </p>
          )}
          {cls.fields.map((f) => (
            <div key={f.id} className="grid grid-cols-12 items-center gap-2 rounded-md border p-3">
              <Input
                className="col-span-4"
                value={f.name}
                onChange={(e) => updateField(f.id, { name: e.target.value })}
                placeholder={tr.field_name_placeholder}
              />
              <div className="col-span-4">
                <Select value={fieldTypeValue(f.type)} onValueChange={(v) => setFieldType(f.id, v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIMITIVE_TYPES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={`class:${c.id}`}>
                        {c.name} (class){c.id === cls.id ? ` ${tr.self_ref_suffix}` : ""}
                      </SelectItem>
                    ))}
                    {enums.map((e) => (
                      <SelectItem key={e.id} value={`enum:${e.id}`}>{e.name} (enum)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="col-span-3 flex items-center gap-2 text-sm">
                <Switch checked={f.isList} onCheckedChange={(v) => updateField(f.id, { isList: v })} />
                {tr.list}
              </label>
              <Button
                variant="ghost"
                size="icon"
                className="col-span-1 justify-self-end"
                onClick={() => actions.updateClass(cls.id, { fields: cls.fields.filter((x) => x.id !== f.id) })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold text-muted-foreground">{tr.csharp_preview}</h3>
        <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-4 font-mono text-xs leading-relaxed">{csharp}</pre>
      </div>
    </div>
  );
}
