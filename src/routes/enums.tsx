import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actions, useGameFlow } from "@/lib/gameflow-store";
import { computeEnumNumbers, enumToCSharp, uid, type EnumObject, type EnumValue } from "@/lib/gameflow-types";
import { Plus, Trash2, ListTree, ArrowUp, ArrowDown, Lock, Unlock } from "lucide-react";
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
      values: [{ name: "VALUE_1" }],
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
  const numbers = computeEnumNumbers(en);

  function patchValues(next: EnumValue[]) {
    actions.updateEnum(en.id, { values: next });
  }
  function setName(i: number, name: string) {
    const next = en.values.map((v, idx) => (idx === i ? { ...v, name } : v));
    patchValues(next);
  }
  function setLocked(i: number, locked: boolean) {
    const next = en.values.map((v, idx) =>
      idx === i ? { ...v, value: locked ? (v.value ?? numbers[i] ?? 0) : null } : v,
    );
    patchValues(next);
  }
  function setNumber(i: number, raw: string) {
    const n = raw === "" || raw === "-" ? 0 : Number(raw);
    if (!Number.isFinite(n)) return;
    const next = en.values.map((v, idx) => (idx === i ? { ...v, value: Math.trunc(n) } : v));
    patchValues(next);
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= en.values.length) return;
    const next = [...en.values];
    [next[i], next[j]] = [next[j], next[i]];
    patchValues(next);
  }
  function removeValue(i: number) {
    patchValues(en.values.filter((_, idx) => idx !== i));
  }
  function addValue() {
    patchValues([...en.values, { name: `VALUE_${en.values.length + 1}` }]);
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
          {en.values.map((v, i) => {
            const locked = v.value != null;
            return (
              <div key={i} className="flex items-center gap-2 rounded-md border p-2">
                <div className="flex flex-col">
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => move(i, 1)} disabled={i === en.values.length - 1}>
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
                <span className="w-10 text-center font-mono text-xs text-muted-foreground">{numbers[i]}</span>
                <Input
                  value={v.name}
                  onChange={(e) => setName(i, e.target.value)}
                  placeholder={tr.value_placeholder}
                  className="font-mono"
                />
                <Input
                  type="number"
                  value={locked ? String(v.value) : ""}
                  onChange={(e) => setNumber(i, e.target.value)}
                  disabled={!locked}
                  placeholder="auto"
                  className="w-24 font-mono"
                />
                <Button
                  variant={locked ? "default" : "ghost"}
                  size="icon"
                  onClick={() => setLocked(i, !locked)}
                  title={locked ? tr.unlock_number : tr.lock_number}
                >
                  {locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => removeValue(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold text-muted-foreground">{tr.csharp_preview}</h3>
        <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-4 font-mono text-xs leading-relaxed">{enumToCSharp(en)}</pre>
      </div>
    </div>
  );
}
