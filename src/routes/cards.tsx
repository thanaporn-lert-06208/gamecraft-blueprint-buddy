import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useTrackScroll } from "@/lib/header-scroll";
import { actions, setState, useGameFlow } from "@/lib/gameflow-store";
import {
  defaultValueFor,
  DEFAULT_EXPORT_SETTINGS,
  getAllFields,
  getFolderPath,
  makeEmptyObject,
  uid,
  type Card,
  type ClassField,
  type ClassObject,
  type EnumObject,
  type FieldType,
  type Folder,
  type GameFlowState,
} from "@/lib/gameflow-types";
import { Plus, Trash2, Download, FileJson, FileText, Package, Layers, Copy, Upload, Settings, Folder as FolderIcon, FolderPlus, ChevronRight, ChevronDown, FolderOpen, Pencil, FolderInput } from "lucide-react";
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

type FolderOption = { id: string; label: string; depth: number };

function flattenFolderTree(folders: Folder[], parentId: string | null = null, depth = 0, prefix = ""): FolderOption[] {
  const out: FolderOption[] = [];
  for (const f of folders.filter((x) => x.parentId === parentId)) {
    const label = prefix ? `${prefix}/${f.name}` : f.name;
    out.push({ id: f.id, label, depth });
    out.push(...flattenFolderTree(folders, f.id, depth + 1, label));
  }
  return out;
}

type TR = ReturnType<typeof import("@/lib/i18n").useLang>["t"];

function CardRow({
  card, classes, folderOptions, depth, isSelected, onSelect, onDeleteSelected, tr,
}: {
  card: Card;
  classes: ClassObject[];
  folderOptions: FolderOption[];
  depth: number;
  isSelected: boolean;
  onSelect: () => void;
  onDeleteSelected: () => void;
  tr: TR;
}) {
  const cls = classes.find((c) => c.id === card.classId);
  return (
    <div
      className={`group flex w-full items-center gap-1 rounded-md px-2 py-1 text-sm transition ${
        isSelected ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"
      }`}
      style={{ paddingLeft: `${8 + depth * 14}px` }}
    >
      <button onClick={onSelect} className="flex flex-1 items-center gap-2 truncate text-left">
        <Layers className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">{card.name}</span>
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{cls?.name ?? "?"}</span>
      </button>
      <div className="opacity-0 group-hover:opacity-100">
        <Select
          value={card.folderId ?? "__root__"}
          onValueChange={(v) => actions.moveCard(card.id, v === "__root__" ? null : v)}
        >
          <SelectTrigger className="flex h-7 w-7 items-center justify-center border-0 bg-transparent p-0 [&>svg]:hidden" title={tr.move_to_folder}>
            <FolderInput className="h-3.5 w-3.5" />
          </SelectTrigger>
          <SelectContent>
            {folderOptions.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                <span style={{ paddingLeft: `${o.depth * 10}px` }}>{o.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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
            folderId: card.folderId ?? null,
          };
          actions.addCard(clone);
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
          if (isSelected) onDeleteSelected();
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function FolderNode({
  folder, allFolders, allCards, classes, folderOptions, depth,
  expanded, setExpanded, renamingId, setRenamingId,
  activeFolderId, setActiveFolderId, selectedId, setSelectedId,
  onCreateSubfolder, tr,
}: {
  folder: Folder;
  allFolders: Folder[];
  allCards: Card[];
  classes: ClassObject[];
  folderOptions: FolderOption[];
  depth: number;
  expanded: Record<string, boolean>;
  setExpanded: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
  activeFolderId: string | null;
  setActiveFolderId: (id: string | null) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  onCreateSubfolder: (parentId: string | null) => void;
  tr: TR;
}) {
  const isOpen = expanded[folder.id] ?? true;
  const isActive = activeFolderId === folder.id;
  const children = allFolders.filter((f) => f.parentId === folder.id);
  const folderCards = allCards.filter((c) => c.folderId === folder.id);
  const isRenaming = renamingId === folder.id;

  return (
    <div>
      <div
        className={`group flex w-full items-center gap-1 rounded-md px-2 py-1 text-sm transition ${
          isActive ? "bg-primary/10 text-foreground" : "text-foreground/80 hover:bg-accent/50"
        }`}
        style={{ paddingLeft: `${4 + depth * 14}px` }}
      >
        <button
          className="flex h-5 w-5 items-center justify-center text-muted-foreground"
          onClick={() => setExpanded((e) => ({ ...e, [folder.id]: !isOpen }))}
        >
          {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        {isOpen ? <FolderOpen className="h-4 w-4 shrink-0" /> : <FolderIcon className="h-4 w-4 shrink-0" />}
        {isRenaming ? (
          <Input
            autoFocus
            defaultValue={folder.name}
            className="h-6 flex-1 px-1 py-0 text-sm"
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v) actions.updateFolder(folder.id, { name: v });
              setRenamingId(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setRenamingId(null);
            }}
          />
        ) : (
          <button
            className="flex-1 truncate text-left"
            onClick={() => setActiveFolderId(isActive ? null : folder.id)}
            onDoubleClick={() => setRenamingId(folder.id)}
            title={tr.move_to_folder}
          >
            {folder.name}
          </button>
        )}
        <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" title={tr.new_subfolder}
          onClick={() => onCreateSubfolder(folder.id)}>
          <FolderPlus className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" title={tr.rename_folder}
          onClick={() => setRenamingId(folder.id)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:text-destructive"
          title={tr.delete_folder}
          onClick={() => {
            if (!window.confirm(tr.delete_folder_confirm)) return;
            actions.deleteFolder(folder.id);
            if (activeFolderId === folder.id) setActiveFolderId(null);
          }}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {isOpen && (
        <div className="space-y-1">
          {folderCards.map((c) => (
            <CardRow
              key={c.id}
              card={c}
              classes={classes}
              folderOptions={folderOptions}
              depth={depth + 1}
              isSelected={selectedId === c.id}
              onSelect={() => setSelectedId(c.id)}
              onDeleteSelected={() => setSelectedId(null)}
              tr={tr}
            />
          ))}
          {children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              allFolders={allFolders}
              allCards={allCards}
              classes={classes}
              folderOptions={folderOptions}
              depth={depth + 1}
              expanded={expanded}
              setExpanded={setExpanded}
              renamingId={renamingId}
              setRenamingId={setRenamingId}
              activeFolderId={activeFolderId}
              setActiveFolderId={setActiveFolderId}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              onCreateSubfolder={onCreateSubfolder}
              tr={tr}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CardsPage() {
  const { classes, enums, cards, folders, settings } = useGameFlow();
  const { t: tr } = useLang();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingClassId, setPendingClassId] = useState<string>("");
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedId(cards[0]?.id ?? null);
    setPendingClassId(classes[0]?.id ?? "");
  }, [cards, classes]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const selected = cards.find((c) => c.id === selectedId) ?? null;

  function folderPath(folderId: string | null | undefined): string {
    const path = getFolderPath(folders, folderId ?? null);
    return path.map((f) => f.name).join("/");
  }

  function fileBase(card: Card): string {
    if (!settings.includeLabelInFilename) return card.name;
    const cls = classes.find((c) => c.id === card.classId);
    const label = cls?.label?.trim();
    return label ? `${label}${settings.separator}${card.name}` : card.name;
  }

  function zipPathFor(card: Card): string {
    const p = folderPath(card.folderId);
    if (p) return `${p}/${fileBase(card)}${jsonExt}`;
    const cls = classes.find((c) => c.id === card.classId);
    const folder = cls?.name ?? "Unfiled";
    return `${folder}/${fileBase(card)}${jsonExt}`;
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
      folderId: activeFolderId,
    };
    actions.addCard(card);
    setSelectedId(card.id);
  }

  function createFolder(parentId: string | null) {
    const folder: Folder = { id: uid(), name: tr.new_folder, parentId };
    actions.addFolder(folder);
    if (parentId) setExpanded((e) => ({ ...e, [parentId]: true }));
    setRenamingId(folder.id);
  }

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function exportAllZip() {
    const zip = new JSZip();
    const manifest: GameFlowState = { classes, enums, cards, folders, settings };
    zip.file("_gameflow.json", JSON.stringify(manifest, null, 2));
    for (const card of cards) {
      zip.file(zipPathFor(card), JSON.stringify(card.data, null, 2));
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
          cards: (parsed.cards ?? []).map((c) => ({ ...c, folderId: c.folderId ?? null })),
          folders: parsed.folders ?? [],
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
        newCards.push({ id: uid(), name: base, classId: cls.id, data, folderId: null });
      }
      setState((s) => ({ ...s, cards: [...s.cards, ...newCards] }));
      window.alert(tr.import_success);
    } catch (err) {
      console.error(err);
      window.alert(tr.import_failed);
    }
  }

  const rootFolders = folders.filter((f) => !f.parentId);
  const rootCards = cards.filter((c) => !c.folderId || !folders.some((f) => f.id === c.folderId));

  const folderOptions = [
    { id: "__root__", label: tr.unfiled, depth: 0 },
    ...flattenFolderTree(folders),
  ];


  const leftScrollRef = useTrackScroll("cards-left");
  const rightScrollRef = useTrackScroll("cards-right");

  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <div className="flex h-[calc(100vh-65px)] flex-col">
        <ResizablePanelGroup orientation="horizontal" className="flex-1">
          <ResizablePanel defaultSize={32} minSize={20}>
            <div ref={leftScrollRef} className="h-full overflow-auto px-4 py-4">
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

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 px-1">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{tr.cards_header}</h2>
                    <div className="flex items-center gap-1">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost" title={tr.export_settings}>
                            <Settings className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{tr.export_settings}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3">
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
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">{tr.json_extension}</Label>
                              <Input
                                value={settings.jsonExtension}
                                onChange={(e) => actions.updateSettings({ jsonExtension: e.target.value })}
                                placeholder=".json"
                                className="font-mono"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">{tr.txt_extension}</Label>
                              <Input
                                value={settings.txtExtension}
                                onChange={(e) => actions.updateSettings({ txtExtension: e.target.value })}
                                placeholder=".txt"
                                className="font-mono"
                              />
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
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
                      <Button size="sm" variant="ghost" onClick={() => createFolder(null)} title={tr.new_folder}>
                        <FolderPlus className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} title={tr.import_zip}>
                        <Upload className="h-4 w-4" />
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" variant="outline" onClick={exportAllZip} disabled={false}>
                            <Package className="h-4 w-4" /> ZIP
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{tr.export_zip}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  {activeFolderId !== null && (
                    <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                      <FolderOpen className="h-3.5 w-3.5" />
                      <span className="flex-1 truncate">{folderPath(activeFolderId) || tr.unfiled}</span>
                      <button className="text-xs underline" onClick={() => setActiveFolderId(null)}>{tr.root_folder}</button>
                    </div>
                  )}

                  {cards.length === 0 && folders.length === 0 && (
                    <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{tr.no_cards}</p>
                  )}

                  {rootCards.map((card) => (
                    <CardRow
                      key={card.id}
                      card={card}
                      classes={classes}
                      folderOptions={folderOptions}
                      depth={0}
                      isSelected={selectedId === card.id}
                      onSelect={() => setSelectedId(card.id)}
                      onDeleteSelected={() => setSelectedId(null)}
                      tr={tr}
                    />
                  ))}

                  {rootFolders.map((f) => (
                    <FolderNode
                      key={f.id}
                      folder={f}
                      allFolders={folders}
                      allCards={cards}
                      classes={classes}
                      folderOptions={folderOptions}
                      depth={0}
                      expanded={expanded}
                      setExpanded={setExpanded}
                      renamingId={renamingId}
                      setRenamingId={setRenamingId}
                      activeFolderId={activeFolderId}
                      setActiveFolderId={setActiveFolderId}
                      selectedId={selectedId}
                      setSelectedId={setSelectedId}
                      onCreateSubfolder={createFolder}
                      tr={tr}
                    />
                  ))}
                </div>
              </aside>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={68} minSize={30}>
            <div ref={rightScrollRef} className="h-full overflow-auto px-6 py-4">
              {selected ? (
                <CardEditor
                  key={selected.id}
                  card={selected}
                  fileBase={fileBase(selected)}
                  jsonExt={jsonExt}
                  txtExt={txtExt}
                  onDelete={() => { actions.deleteCard(selected.id); setSelectedId(null); }}
                />
              ) : (
                <div className="grid h-64 place-items-center rounded-xl border border-dashed text-muted-foreground">
                  {tr.select_or_create_card}
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

function CardEditor({ card, fileBase, jsonExt, txtExt, onDelete }: { card: Card; fileBase: string; jsonExt: string; txtExt: string; onDelete: () => void }) {
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
    download(`${fileBase}${jsonExt}`, JSON.stringify(card.data, null, 2), "application/json");
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
    download(`${fileBase}${txtExt}`, lines.join("\n"), "text/plain");
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
        <Button variant="outline" onClick={exportTxt}><FileText className="h-4 w-4" /> {txtExt}</Button>
        <Button variant="outline" onClick={exportJson}><FileJson className="h-4 w-4" /> {jsonExt}</Button>
        <Button variant="destructive" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
      </div>

      <Tabs defaultValue="edit" className="w-full">
        <TabsList>
          <TabsTrigger value="edit">{tr.view_edit}</TabsTrigger>
          <TabsTrigger value="json">{tr.json_preview}</TabsTrigger>
        </TabsList>
        <TabsContent value="edit">
          <div className="rounded-xl border bg-card p-5">
            <ObjectEditor
              fields={fields}
              value={card.data}
              onChange={setData}
            />
          </div>
        </TabsContent>
        <TabsContent value="json">
          <div className="rounded-xl border bg-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground">{tr.json_preview}</h3>
              <Button size="sm" variant="ghost" onClick={exportJson}><Download className="h-4 w-4" /></Button>
            </div>
            <pre className="overflow-x-auto rounded-md bg-muted p-4 font-mono text-xs leading-relaxed">
{JSON.stringify(card.data, null, 2)}
            </pre>
          </div>
        </TabsContent>
      </Tabs>
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
