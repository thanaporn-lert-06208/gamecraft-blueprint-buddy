import { createFileRoute, Link } from "@tanstack/react-router";
import { AppNav } from "@/components/AppNav";
import { useGameFlow } from "@/lib/gameflow-store";
import { useLang } from "@/lib/i18n";
import { Boxes, Layers, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GameFlow Forge — C# Class & Card Builder" },
      { name: "description", content: "Design C#-style class objects and build structured game data cards. Export to TXT, JSON, or ZIP." },
      { property: "og:title", content: "GameFlow Forge" },
      { property: "og:description", content: "Design C#-style class objects and build structured game data cards." },
    ],
  }),
  component: Home,
});

function Home() {
  const { classes, cards } = useGameFlow();
  const { t } = useLang();
  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <main className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-4xl font-bold tracking-tight">{t.home_title}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{t.home_desc}</p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link
            to="/classes"
            className="group rounded-xl border bg-card p-6 transition hover:border-primary hover:shadow-lg"
          >
            <Boxes className="h-8 w-8 text-primary" />
            <h2 className="mt-4 text-lg font-semibold">{t.home_classes_title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.home_classes_desc}</p>
            <div className="mt-6 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t.count_classes(classes.length)}</span>
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            to="/cards"
            className="group rounded-xl border bg-card p-6 transition hover:border-primary hover:shadow-lg"
          >
            <Layers className="h-8 w-8 text-primary" />
            <h2 className="mt-4 text-lg font-semibold">{t.home_cards_title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.home_cards_desc}</p>
            <div className="mt-6 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t.count_cards(cards.length)}</span>
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
