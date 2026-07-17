import { useSyncExternalStore } from "react";

export interface LocalizationData {
  languages: string[];
  rows: Record<string, Record<string, string>>;
  fetchedAt: number | null;
}

export interface LocalizationState {
  sheetUrl: string;
  sheetName: string;
  data: LocalizationData;
  currentLang: string;
  showPreview: boolean;
}

const KEY = "gameflow_loc_v1";
const initial: LocalizationState = {
  sheetUrl: "",
  sheetName: "",
  data: { languages: [], rows: {}, fetchedAt: null },
  currentLang: "",
  showPreview: false,
};

let state = initial;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...initial, ...JSON.parse(raw) };
  } catch {}
}

function persist() {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(state));
}
function emit() {
  persist();
  listeners.forEach((l) => l());
}

export function getLocState() {
  return state;
}
export function setLocState(updater: (s: LocalizationState) => LocalizationState) {
  state = updater(state);
  emit();
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
export function useLocalization(): LocalizationState {
  return useSyncExternalStore(subscribe, getLocState, () => initial);
}

export function extractSheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m?.[1] ?? null;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQ = false;
        }
      } else cell += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") {
        row.push(cell);
        cell = "";
      } else if (c === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else if (c === "\r") {
        /* skip */
      } else cell += c;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export async function fetchSheet(url: string, sheetName: string): Promise<LocalizationData> {
  const id = extractSheetId(url);
  if (!id) throw new Error("Invalid Google Sheet URL");
  const base = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv`;
  const finalUrl = sheetName.trim() ? `${base}&sheet=${encodeURIComponent(sheetName.trim())}` : base;
  const res = await fetch(finalUrl);
  if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
  const text = await res.text();
  const raw = parseCsv(text).filter((r) => r.some((c) => c !== ""));
  if (raw.length === 0) return { languages: [], rows: {}, fetchedAt: Date.now() };
  const header = raw[0];
  const languages = header.slice(1).map((s) => s.trim()).filter(Boolean);
  const rows: Record<string, Record<string, string>> = {};
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i];
    const key = (r[0] ?? "").trim();
    if (!key) continue;
    const entry: Record<string, string> = {};
    languages.forEach((lang, idx) => {
      entry[lang] = r[idx + 1] ?? "";
    });
    rows[key] = entry;
  }
  return { languages, rows, fetchedAt: Date.now() };
}

export function translate(data: LocalizationData, key: string, lang: string): string | null {
  if (!key || !lang) return null;
  const row = data.rows[key];
  if (!row) return null;
  const val = row[lang];
  return val ?? null;
}
