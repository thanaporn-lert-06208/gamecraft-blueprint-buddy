import { Link } from "@tanstack/react-router";
import { Boxes, Layers, Languages, ListTree } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export function AppNav() {
  const { t, lang, toggle } = useLang();
  const linkBase =
    "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition";
  const inactive = `${linkBase} text-muted-foreground hover:bg-accent hover:text-foreground`;
  const active = `${linkBase} bg-accent text-foreground font-medium`;

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            GF
          </span>
          <span>{t.appName}</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link to="/classes" className={inactive} activeProps={{ className: active }}>
            <Boxes className="h-4 w-4" /> {t.nav_classes}
          </Link>
          <Link to="/enums" className={inactive} activeProps={{ className: active }}>
            <ListTree className="h-4 w-4" /> {t.nav_enums}
          </Link>
          <Link to="/cards" className={inactive} activeProps={{ className: active }}>
            <Layers className="h-4 w-4" /> {t.nav_cards}
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={toggle}
            className="ml-2"
            aria-label={t.lang_label}
          >
            <Languages className="h-4 w-4" />
            {lang === "en" ? "EN" : "ไทย"}
          </Button>
        </nav>
      </div>
    </header>
  );
}
