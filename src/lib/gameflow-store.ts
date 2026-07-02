import { useSyncExternalStore } from "react";
import { DEFAULT_EXPORT_SETTINGS, getFolderDescendantIds, type Card, type ClassObject, type EnumObject, type ExportSettings, type Folder, type GameFlowState } from "./gameflow-types";

const STORAGE_KEY = "gameflow_state_v1";

let state: GameFlowState = { classes: [], enums: [], cards: [], folders: [], settings: DEFAULT_EXPORT_SETTINGS };
const listeners = new Set<() => void>();

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GameFlowState>;
      const enums = (parsed.enums ?? []).map((e) => ({
        ...e,
        values: (e.values as unknown as Array<string | { id?: string; name: string; value?: number | null }>).map((v, i) =>
          typeof v === "string"
            ? { id: `${e.id}_${i}_${Math.random().toString(36).slice(2, 8)}`, name: v }
            : { id: v.id ?? `${e.id}_${i}_${Math.random().toString(36).slice(2, 8)}`, name: v.name, value: v.value ?? null },
        ),
      }));
      state = {
        classes: parsed.classes ?? [],
        enums,
        cards: (parsed.cards ?? []).map((c) => ({ ...c, folderId: c.folderId ?? null })),
        folders: parsed.folders ?? [],
        settings: { ...DEFAULT_EXPORT_SETTINGS, ...(parsed.settings ?? {}) },
      };
    }
  } catch {}
}
load();

function persist() {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

export function getState() { return state; }

export function setState(updater: (s: GameFlowState) => GameFlowState) {
  const next = updater(state);
  // Ensure folders always exists after external restores.
  state = { ...next, folders: next.folders ?? [] };
  emit();
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function useGameFlow(): GameFlowState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export const actions = {
  addClass(cls: ClassObject) {
    setState((s) => ({ ...s, classes: [...s.classes, cls] }));
  },
  updateClass(id: string, patch: Partial<ClassObject>) {
    setState((s) => ({ ...s, classes: s.classes.map((c) => c.id === id ? { ...c, ...patch } : c) }));
  },
  deleteClass(id: string) {
    setState((s) => ({
      ...s,
      classes: s.classes.filter((c) => c.id !== id).map((c) => ({
        ...c,
        parentId: c.parentId === id ? null : c.parentId,
        fields: c.fields.filter((f) => !(f.type.kind === "class" && f.type.classId === id)),
      })),
      cards: s.cards.filter((card) => card.classId !== id),
    }));
  },
  addEnum(en: EnumObject) {
    setState((s) => ({ ...s, enums: [...s.enums, en] }));
  },
  updateEnum(id: string, patch: Partial<EnumObject>) {
    setState((s) => ({ ...s, enums: s.enums.map((e) => e.id === id ? { ...e, ...patch } : e) }));
  },
  deleteEnum(id: string) {
    setState((s) => ({
      ...s,
      enums: s.enums.filter((e) => e.id !== id),
      classes: s.classes.map((c) => ({
        ...c,
        fields: c.fields.filter((f) => !(f.type.kind === "enum" && f.type.enumId === id)),
      })),
    }));
  },
  addCard(card: Card) {
    setState((s) => ({ ...s, cards: [...s.cards, { ...card, folderId: card.folderId ?? null }] }));
  },
  updateCard(id: string, patch: Partial<Card>) {
    setState((s) => ({ ...s, cards: s.cards.map((c) => c.id === id ? { ...c, ...patch } : c) }));
  },
  deleteCard(id: string) {
    setState((s) => ({ ...s, cards: s.cards.filter((c) => c.id !== id) }));
  },
  moveCard(id: string, folderId: string | null) {
    setState((s) => ({ ...s, cards: s.cards.map((c) => c.id === id ? { ...c, folderId } : c) }));
  },
  addFolder(folder: Folder) {
    setState((s) => ({ ...s, folders: [...s.folders, folder] }));
  },
  updateFolder(id: string, patch: Partial<Folder>) {
    setState((s) => ({ ...s, folders: s.folders.map((f) => f.id === id ? { ...f, ...patch } : f) }));
  },
  moveFolder(id: string, parentId: string | null) {
    setState((s) => {
      if (id === parentId) return s;
      // prevent cycles: can't move into own descendant
      const descendants = getFolderDescendantIds(s.folders, id);
      if (parentId && descendants.has(parentId)) return s;
      return { ...s, folders: s.folders.map((f) => f.id === id ? { ...f, parentId } : f) };
    });
  },
  deleteFolder(id: string) {
    setState((s) => {
      const descendants = getFolderDescendantIds(s.folders, id);
      const doomed = new Set<string>([id, ...descendants]);
      return {
        ...s,
        folders: s.folders.filter((f) => !doomed.has(f.id)),
        cards: s.cards.map((c) => (c.folderId && doomed.has(c.folderId) ? { ...c, folderId: null } : c)),
      };
    });
  },
  updateSettings(patch: Partial<ExportSettings>) {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  },
};
