import { useSyncExternalStore } from "react";

export type Lang = "en" | "th";

const STORAGE_KEY = "gameflow_lang";
let lang: Lang = "en";
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
  if (saved === "en" || saved === "th") lang = saved;
}

export function getLang(): Lang { return lang; }
export function setLang(l: Lang) {
  lang = l;
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, l);
  listeners.forEach((fn) => fn());
}
function subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

const dict = {
  en: {
    appName: "GameFlow Forge",
    nav_classes: "Classes",
    nav_cards: "Cards",
    home_title: "GameFlow Forge",
    home_desc: "Design C#-style class objects, then build structured game data cards from them. Export to TXT, JSON, or download everything as a ZIP.",
    home_classes_title: "Class Objects",
    home_classes_desc: "Define fields, inheritance, and nested class references.",
    home_cards_title: "Cards",
    home_cards_desc: "Instantiate data records from your classes and export them.",
    count_classes: (n: number) => `${n} defined`,
    count_cards: (n: number) => `${n} created`,
    classes_header: "Classes",
    classes_empty: "No classes yet. Click + to create one.",
    select_or_create_class: "Select or create a class to edit it.",
    class_name: "Class name",
    inherits_from: "Inherits from",
    none: "— None —",
    delete: "Delete",
    inherited_fields: "Inherited fields",
    fields: "Fields",
    add_field: "Add field",
    no_fields: "No fields. Add one to begin.",
    field_name_placeholder: "field name",
    list: "List",
    csharp_preview: "C# preview",
    new_card_from_class: "New card from class",
    pick_a_class: "Pick a class",
    create_card: "Create card",
    define_class_first: "Define a class first on the Classes page.",
    cards_header: "Cards",
    no_cards: "No cards yet.",
    select_or_create_card: "Select or create a card to edit it.",
    card_name: "Card name",
    class_label: "Class:",
    json_preview: "JSON preview",
    no_fields_class: "No fields on this class.",
    add: "Add",
    empty_list: "Empty list",
    class_missing: "Class missing.",
    lang_label: "Language",
  },
  th: {
    appName: "GameFlow Forge",
    nav_classes: "คลาส",
    nav_cards: "การ์ด",
    home_title: "GameFlow Forge",
    home_desc: "ออกแบบ Class Object สไตล์ C# แล้วสร้างการ์ดข้อมูลเกมจากคลาสนั้น ส่งออกเป็น TXT, JSON หรือดาวน์โหลดทั้งหมดเป็น ZIP",
    home_classes_title: "Class Objects",
    home_classes_desc: "กำหนดฟิลด์ การสืบทอด และอ้างอิงคลาสซ้อนได้",
    home_cards_title: "การ์ด",
    home_cards_desc: "สร้างข้อมูลตามโครงสร้างคลาส แล้วส่งออกเป็นไฟล์",
    count_classes: (n: number) => `${n} คลาส`,
    count_cards: (n: number) => `${n} การ์ด`,
    classes_header: "คลาส",
    classes_empty: "ยังไม่มีคลาส กดปุ่ม + เพื่อสร้าง",
    select_or_create_class: "เลือกหรือสร้างคลาสเพื่อแก้ไข",
    class_name: "ชื่อคลาส",
    inherits_from: "สืบทอดจาก",
    none: "— ไม่มี —",
    delete: "ลบ",
    inherited_fields: "ฟิลด์ที่สืบทอด",
    fields: "ฟิลด์",
    add_field: "เพิ่มฟิลด์",
    no_fields: "ยังไม่มีฟิลด์ กดเพิ่มเพื่อเริ่มต้น",
    field_name_placeholder: "ชื่อฟิลด์",
    list: "ลิสต์",
    csharp_preview: "พรีวิว C#",
    new_card_from_class: "สร้างการ์ดใหม่จากคลาส",
    pick_a_class: "เลือกคลาส",
    create_card: "สร้างการ์ด",
    define_class_first: "กรุณาสร้างคลาสก่อนที่หน้าคลาส",
    cards_header: "การ์ด",
    no_cards: "ยังไม่มีการ์ด",
    select_or_create_card: "เลือกหรือสร้างการ์ดเพื่อแก้ไข",
    card_name: "ชื่อการ์ด",
    class_label: "คลาส:",
    json_preview: "พรีวิว JSON",
    no_fields_class: "คลาสนี้ไม่มีฟิลด์",
    add: "เพิ่ม",
    empty_list: "ลิสต์ว่าง",
    class_missing: "ไม่พบคลาส",
    lang_label: "ภาษา",
  },
};

export type Dict = (typeof dict)["en"];

export function useLang(): { lang: Lang; t: Dict; toggle: () => void } {
  const current = useSyncExternalStore(subscribe, getLang, getLang);
  return {
    lang: current,
    t: dict[current],
    toggle: () => setLang(current === "en" ? "th" : "en"),
  };
}
