import { useSyncExternalStore } from "react";
import type { Card, ClassObject, GameFlowState } from "./gameflow-types";

const STORAGE_KEY = "gameflow_state_v1";

let state: GameFlowState = { classes: [], cards: [] };
const listeners = new Set<() => void>();

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = JSON.parse(raw);
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
  state = updater(state);
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
      classes: s.classes.filter((c) => c.id !== id).map((c) =>
        c.parentId === id ? { ...c, parentId: null } : c
      ),
      cards: s.cards.filter((card) => card.classId !== id),
    }));
  },
  addCard(card: Card) {
    setState((s) => ({ ...s, cards: [...s.cards, card] }));
  },
  updateCard(id: string, patch: Partial<Card>) {
    setState((s) => ({ ...s, cards: s.cards.map((c) => c.id === id ? { ...c, ...patch } : c) }));
  },
  deleteCard(id: string) {
    setState((s) => ({ ...s, cards: s.cards.filter((c) => c.id !== id) }));
  },
};
