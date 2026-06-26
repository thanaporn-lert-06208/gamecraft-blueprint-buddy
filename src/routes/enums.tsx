import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actions, useGameFlow } from "@/lib/gameflow-store";
import { enumToCSharp, uid, type EnumObject } from "@/lib/gameflow-types";
import { Plus, Trash2, ListTree } from "lucide-react";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/enums")({
  head: () => ({
    meta: [
      { title: "Enum Builder — GameFlow Forge" },
      { name: "description", content: "Define reusable C#-style enum types for use in your class objects." },
    ],
  }),
  component: EnumsPage,
});

function EnumsPage() {
  const { enums } = useGameFlow();
  const { t: tr } = useLang();
  const [selectedId, setSelectedId] = useState<string | null>(enums[0]?.id ?? null);
  const selected = enums.find((e) => e.id === selectedId) ?? null;

  function createEnum() {
    const en: EnumObject = {
      id: uid(),
      name: `NewEnum${enums.length + 1}`,
      values: ["VALUE_1"],
    };
    actions.addEnum(en);
    setSelectedId(en.id);
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{tr.enums_header}</h2>
            <Button size="sm" onClick={createEnum}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="space-y-1">
            {enums.length === 0 && (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                {tr.enums_empty}
              </p>
            )}
            {enums.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelectedId(e.id)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
                  selectedId === e.id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"
                }`}
              >
                <ListTree className="h-4 w-4" />
                <span className="truncate">{e.name}</span>
              </button>
            ))}
          </div>
        </aside>

        <section>
          {selected ? (
            <EnumEditor
              key={selected.id}
              en={selected}
              onDelete={() => { actions.deleteEnum(selected.id); setSelectedId(null); }}
            />
          ) : (
            <div className="grid h-64 place-items-center rounded-xl border border-dashed text-muted-foreground">
              {tr.select_or_create_enum}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function EnumEditor({ en, onDelete }: { en: EnumObject; onDelete: () => void }) {
  const { t: tr } = useLang();

  function setValue(i: number, v: string) {
    const next = [...en.values];
    next[i] = v;
    actions.updateEnum(en.id, { values: next });
  }
  function removeValue(i: number) {
    actions.updateEnum(en.id, { values: en.values.filter((_, idx) => idx !== i) });
  }
  function addValue() {
    actions.updateEnum(en.id, { values: [...en.values, `VALUE_${en.values.length + 1}`] });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-5">
        <div className="grow space-y-2">
          <Label>{tr.enum_name}</Label>
          <Input
            value={en.name}
            onChange={(e) => actions.updateEnum(en.id, { name: e.target.value })}
            className="text-lg font-medium"
          />
        </div>
        <Button variant="destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" /> {tr.delete}
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{tr.enum_values}</h3>
          <Button size="sm" onClick={addValue}><Plus className="h-4 w-4" /> {tr.add_value}</Button>
        </div>
        <div className="mt-4 space-y-2">
          {en.values.length === 0 && (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{tr.no_values}</p>
          )}
          {en.values.map((v, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border p-2">
              <span className="w-8 text-center font-mono text-xs text-muted-foreground">{i}</span>
              <Input
                value={v}
                onChange={(e) => setValue(i, e.target.value)}
                placeholder={tr.value_placeholder}
                className="font-mono"
              />
              <Button variant="ghost" size="icon" onClick={() => removeValue(i)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold text-muted-foreground">{tr.csharp_preview}</h3>
        <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-4 font-mono text-xs leading-relaxed">{enumToCSharp(en)}</pre>
      </div>
    </div>
  );
}
