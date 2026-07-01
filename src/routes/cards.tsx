import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { actions, setState, useGameFlow } from "@/lib/gameflow-store";
import {
  defaultValueFor,
  DEFAULT_EXPORT_SETTINGS,
  getAllFields,
  makeEmptyObject,
  uid,
  type Card,
  type ClassField,
  type ClassObject,
  type EnumObject,
  type FieldType,
  type GameFlowState,
} from "@/lib/gameflow-types";
import { Plus, Trash2, Download, FileJson, FileText, Package, Layers, Copy, Upload } from "lucide-react";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/cards")({
  head: () => ({
    meta: [
      { title: "Card Builder — GameFlow Forge" },
      { name: "description", content: "Create data cards from your class objects and export to TXT, JSON, or ZIP." },
    ],
  }),
  component: CardsPage,
});

function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function CardsPage() {
  const { classes, enums, cards, settings } = useGameFlow();
  const { t: tr } = useLang();
  const [selectedId, setSelectedId] = useState<string | null>(cards[0]?.id ?? null);
  const [pendingClassId, setPendingClassId] = useState<string>(classes[0]?.id ?? "");

  const selected = cards.find((c) => c.id === selectedId) ?? null;

  function fileBase(card: Card): string {
    if (!settings.includeLabelInFilename) return card.name;
    const cls = classes.find((c) => c.id === card.classId);
    const label = cls?.label?.trim();
    return label ? `${label}${settings.separator}${card.name}` : card.name;
  }

  function normalizeExt(ext: string, fallback: string): string {
    const trimmed = (ext ?? "").trim();
    if (!trimmed) return fallback;
    return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
  }
  const jsonExt = normalizeExt(settings.jsonExtension, ".json");
  const txtExt = normalizeExt(settings.txtExtension, ".txt");

  function createCard() {
    if (!pendingClassId) return;
    const cls = classes.find((c) => c.id === pendingClassId);
    if (!cls) return;
    const card: Card = {
      id: uid(),
      name: `${cls.name}_${cards.length + 1}`,
      classId: cls.id,
      data: makeEmptyObject(classes, cls.id, enums),
    };
    actions.addCard(card);
    setSelectedId(card.id);
  }

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function exportAllZip() {
    const zip = new JSZip();
    const manifest: GameFlowState = { classes, enums, cards, settings };
    zip.file("_gameflow.json", JSON.stringify(manifest, null, 2));
    for (const card of cards) {
      const cls = classes.find((c) => c.id === card.classId);
      const folder = cls?.name ?? "Unknown";
      zip.file(`${folder}/${fileBase(card)}.json`, JSON.stringify(card.data, null, 2));
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gameflow_cards.zip";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importZip(file: File) {
    try {
      const zip = await JSZip.loadAsync(file);
      const manifestFile = zip.file("_gameflow.json");
      if (manifestFile) {
        const text = await manifestFile.async("string");
        const parsed = JSON.parse(text) as Partial<GameFlowState>;
        if (!Array.isArray(parsed.classes) || !Array.isArray(parsed.cards)) throw new Error("bad manifest");
        if (!window.confirm(tr.import_confirm)) return;
        setState(() => ({
          classes: parsed.classes ?? [],
          enums: parsed.enums ?? [],
          cards: parsed.cards ?? [],
          settings: { ...DEFAULT_EXPORT_SETTINGS, ...(parsed.settings ?? {}) },
        }));
        setSelectedId(parsed.cards?.[0]?.id ?? null);
        window.alert(tr.import_success);
        return;
      }
      // Fallback: import loose JSON files as cards, matching folder names to existing classes.
      if (!window.confirm(tr.import_confirm)) return;
      const newCards: Card[] = [];
      const entries = Object.values(zip.files).filter((f) => !f.dir && f.name.endsWith(".json"));
      for (const entry of entries) {
        const parts = entry.name.split("/");
        if (parts.length < 2) continue;
        const folder = parts[0];
        const base = parts[parts.length - 1].replace(/\.json$/i, "");
        const cls = classes.find((c) => c.name === folder);
        if (!cls) continue;
        const data = JSON.parse(await entry.async("string"));
        newCards.push({ id: uid(), name: base, classId: cls.id, data });
      }
      setState((s) => ({ ...s, cards: [...s.cards, ...newCards] }));
      window.alert(tr.import_success);
    } catch (err) {
      console.error(err);
      window.alert(tr.import_failed);
    }
  }


  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-4">
          <div className="space-y-2 rounded-xl border bg-card p-4">
            <Label className="text-xs uppercase text-muted-foreground">{tr.new_card_from_class}</Label>
            <Select value={pendingClassId} onValueChange={setPendingClassId}>
              <SelectTrigger><SelectValue placeholder={tr.pick_a_class} /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={createCard} disabled={!pendingClassId} className="w-full">
              <Plus className="h-4 w-4" /> {tr.create_card}
            </Button>
            {classes.length === 0 && (
              <p className="text-xs text-muted-foreground">{tr.define_class_first}</p>
            )}
          </div>

          <div className="space-y-3 rounded-xl border bg-card p-4">
            <Label className="text-xs uppercase text-muted-foreground">{tr.export_settings}</Label>
            <label className="flex items-center justify-between gap-2 text-sm">
              <span>{tr.include_label_in_filename}</span>
              <Switch
                checked={settings.includeLabelInFilename}
                onCheckedChange={(v) => actions.updateSettings({ includeLabelInFilename: v })}
              />
            </label>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{tr.filename_separator}</Label>
              <Input
                value={settings.separator}
                onChange={(e) => actions.updateSettings({ separator: e.target.value })}
                className="font-mono"
              />
            </div>
          </div>


          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 px-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{tr.cards_header}</h2>
              <div className="flex items-center gap-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip,application/zip"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importZip(f);
                    e.target.value = "";
                  }}
                />
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} title={tr.import_zip}>
                  <Upload className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={exportAllZip} disabled={cards.length === 0}>
                  <Package className="h-4 w-4" /> ZIP
                </Button>
              </div>
            </div>
            {cards.length === 0 && (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{tr.no_cards}</p>
            )}
            {cards.map((card) => {
              const cls = classes.find((c) => c.id === card.classId);
              const isSelected = selectedId === card.id;
              return (
                <div
                  key={card.id}
                  className={`group flex w-full items-center gap-1 rounded-md px-2 py-1 text-sm transition ${
                    isSelected ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"
                  }`}
                >
                  <button
                    onClick={() => setSelectedId(card.id)}
                    className="flex flex-1 items-center gap-2 truncate text-left"
                  >
                    <Layers className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{card.name}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{cls?.name ?? "?"}</span>
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100"
                    title={tr.copy_element}
                    onClick={(e) => {
                      e.stopPropagation();
                      const clone: Card = {
                        id: uid(),
                        name: `${card.name}_copy`,
                        classId: card.classId,
                        data: JSON.parse(JSON.stringify(card.data)),
                      };
                      actions.addCard(clone);
                      setSelectedId(clone.id);
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:text-destructive"
                    title={tr.delete}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!window.confirm(`${tr.delete} "${card.name}"?`)) return;
                      actions.deleteCard(card.id);
                      if (isSelected) setSelectedId(null);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </aside>

        <section>
          {selected ? (
            <CardEditor
              key={selected.id}
              card={selected}
              fileBase={fileBase(selected)}
              onDelete={() => { actions.deleteCard(selected.id); setSelectedId(null); }}
            />
          ) : (
            <div className="grid h-64 place-items-center rounded-xl border border-dashed text-muted-foreground">
              {tr.select_or_create_card}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function CardEditor({ card, fileBase, onDelete }: { card: Card; fileBase: string; onDelete: () => void }) {
  const { classes, enums } = useGameFlow();
  const { t: tr } = useLang();
  const cls = classes.find((c) => c.id === card.classId);

  const fields = useMemo(() => (cls ? getAllFields(classes, cls.id) : []), [classes, cls]);

  if (!cls) {
    return <div className="rounded-xl border bg-card p-6">{tr.class_missing}</div>;
  }

  function setData(next: Record<string, unknown>) {
    actions.updateCard(card.id, { data: next });
  }

  function exportJson() {
    download(`${fileBase}.json`, JSON.stringify(card.data, null, 2), "application/json");
  }
  function exportTxt() {
    const lines = [`# ${cls!.name}: ${card.name}`, ""];
    function walk(obj: unknown, indent: number) {
      const pad = "  ".repeat(indent);
      if (Array.isArray(obj)) {
        obj.forEach((v, i) => {
          if (v !== null && typeof v === "object") {
            lines.push(`${pad}- [${i}]`);
            walk(v, indent + 1);
          } else {
            lines.push(`${pad}- ${String(v)}`);
          }
        });
      } else if (obj && typeof obj === "object") {
        for (const [k, v] of Object.entries(obj)) {
          if (v !== null && typeof v === "object") {
            lines.push(`${pad}${k}:`);
            walk(v, indent + 1);
          } else {
            lines.push(`${pad}${k}: ${String(v)}`);
          }
        }
      } else {
        lines.push(`${pad}${String(obj)}`);
      }
    }
    walk(card.data, 0);
    download(`${fileBase}.txt`, lines.join("\n"), "text/plain");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-5">
        <div className="grow space-y-2">
          <Label>{tr.card_name}</Label>
          <Input value={card.name} onChange={(e) => actions.updateCard(card.id, { name: e.target.value })} />
        </div>
        <div className="text-sm text-muted-foreground">
          {tr.class_label} <span className="font-mono text-foreground">{cls.name}</span>
        </div>
        <Button variant="outline" onClick={exportTxt}><FileText className="h-4 w-4" /> .txt</Button>
        <Button variant="outline" onClick={exportJson}><FileJson className="h-4 w-4" /> .json</Button>
        <Button variant="destructive" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <ObjectEditor
          fields={fields}
          value={card.data}
          onChange={setData}
        />
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">{tr.json_preview}</h3>
          <Button size="sm" variant="ghost" onClick={exportJson}><Download className="h-4 w-4" /></Button>
        </div>
        <pre className="overflow-x-auto rounded-md bg-muted p-4 font-mono text-xs leading-relaxed">
{JSON.stringify(card.data, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function ObjectEditor({
  fields, value, onChange,
}: {
  fields: ClassField[];
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const { t: tr } = useLang();
  return (
    <div className="space-y-4">
      {fields.map((f) => (
        <FieldEditor
          key={f.id}
          field={f}
          value={value[f.name]}
          onChange={(v) => onChange({ ...value, [f.name]: v })}
        />
      ))}
      {fields.length === 0 && <p className="text-sm text-muted-foreground">{tr.no_fields_class}</p>}
    </div>
  );
}

function typeLabel(t: FieldType, classes: ClassObject[], enums: EnumObject[]): string {
  if (t.kind === "primitive") return t.type;
  if (t.kind === "enum") return enums.find((e) => e.id === t.enumId)?.name ?? "?";
  return classes.find((c) => c.id === t.classId)?.name ?? "?";
}

function FieldEditor({
  field, value, onChange,
}: {
  field: ClassField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const { classes, enums } = useGameFlow();
  const { t: tr } = useLang();

  if (field.isList) {
    const arr = Array.isArray(value) ? value : [];
    const itemField: ClassField = { ...field, isList: false };
    return (
      <div className="rounded-md border bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">
            {field.name} <span className="font-mono text-xs text-muted-foreground">[{typeLabel(field.type, classes, enums)}]</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onChange([...arr, defaultValueFor(itemField, classes, enums)])}
          >
            <Plus className="h-4 w-4" /> {tr.add}
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {arr.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 rounded-md border bg-background p-2">
              <span className="mt-2 w-6 text-center font-mono text-xs text-muted-foreground">{idx}</span>
              <div className="flex-1">
                <FieldEditor
                  field={itemField}
                  value={item}
                  onChange={(v) => {
                    const next = [...arr];
                    next[idx] = v;
                    onChange(next);
                  }}
                />
              </div>
              <Button
                size="icon"
                variant="ghost"
                title={tr.copy_element}
                onClick={() => {
                  const next = [...arr];
                  const clone = JSON.parse(JSON.stringify(item));
                  next.splice(idx + 1, 0, clone);
                  onChange(next);
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onChange(arr.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {arr.length === 0 && <p className="text-xs text-muted-foreground">{tr.empty_list}</p>}
        </div>
      </div>
    );
  }

  if (field.type.kind === "primitive") {
    const t = field.type.type;
    return (
      <div className="grid grid-cols-12 items-center gap-3">
        <Label className="col-span-3 truncate text-sm">
          {field.name}
          <span className="ml-1 font-mono text-xs text-muted-foreground">{t}</span>
        </Label>
        <div className="col-span-9">
          {t === "bool" ? (
            <Switch checked={!!value} onCheckedChange={(v) => onChange(v)} />
          ) : t === "string" ? (
            <Input value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
          ) : (
            <Input
              type="number"
              step={t === "float" ? "any" : "1"}
              value={value === undefined || value === null ? "" : String(value)}
              onChange={(e) => {
                const n = e.target.value === "" ? 0 : t === "int" ? parseInt(e.target.value, 10) : parseFloat(e.target.value);
                onChange(Number.isNaN(n) ? 0 : n);
              }}
            />
          )}
        </div>
      </div>
    );
  }

  if (field.type.kind === "enum") {
    const en = enums.find((e) => e.id === (field.type as { enumId: string }).enumId);
    const current = typeof value === "string" ? value : "";
    return (
      <div className="grid grid-cols-12 items-center gap-3">
        <Label className="col-span-3 truncate text-sm">
          {field.name}
          <span className="ml-1 font-mono text-xs text-muted-foreground">{en?.name ?? "?"}</span>
        </Label>
        <div className="col-span-9">
          <Select value={current || undefined} onValueChange={(v) => onChange(v)}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {(en?.values ?? []).map((v) => (
                <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  // class reference (possibly self/recursive). value can be null until user creates it.
  const classId = field.type.classId;
  const refCls = classes.find((c) => c.id === classId);
  const isObj = value !== null && typeof value === "object" && !Array.isArray(value);

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">
          {field.name}
          <span className="ml-1 font-mono text-xs text-muted-foreground">{refCls?.name ?? "?"}</span>
        </div>
        {isObj ? (
          <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
            <Trash2 className="h-4 w-4" /> {tr.clear_nested}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={!refCls}
            onClick={() => refCls && onChange(makeEmptyObject(classes, refCls.id, enums))}
          >
            <Plus className="h-4 w-4" /> {tr.create_nested}
          </Button>
        )}
      </div>
      {isObj && refCls ? (
        <div className="mt-3 space-y-3 border-l-2 border-border pl-4">
          <ObjectEditor
            fields={getAllFields(classes, refCls.id)}
            value={value as Record<string, unknown>}
            onChange={onChange as (v: Record<string, unknown>) => void}
          />
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">{tr.null_value}</p>
      )}
    </div>
  );
}
