import { useSyncExternalStore, useEffect, useRef } from "react";

let visible = true;
const lastYBySource = new Map<string, number>();
const listeners = new Set<() => void>();

function setVisible(v: boolean) {
  if (v === visible) return;
  visible = v;
  listeners.forEach((l) => l());
}

export function reportScroll(source: string, y: number) {
  const prev = lastYBySource.get(source) ?? 0;
  lastYBySource.set(source, y);
  const delta = y - prev;
  if (y <= 4) setVisible(true);
  else if (delta > 4) setVisible(false);
  else if (delta < -4) setVisible(true);
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useHeaderVisible(): boolean {
  return useSyncExternalStore(subscribe, () => visible, () => true);
}

/** Attach scroll tracking to a scrollable element. */
export function useTrackScroll(source: string) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => reportScroll(source, el.scrollTop);
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [source]);
  return ref;
}
