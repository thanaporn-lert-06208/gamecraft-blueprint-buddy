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
        <h1 className="text-4xl font-bold tracking-tight">GameFlow Forge</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Design C#-style class objects, then build structured game data cards from them.
          Export to TXT, JSON, or download everything as a ZIP.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link
            to="/classes"
            className="group rounded-xl border bg-card p-6 transition hover:border-primary hover:shadow-lg"
          >
            <Boxes className="h-8 w-8 text-primary" />
            <h2 className="mt-4 text-lg font-semibold">Class Objects</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Define fields, inheritance, and nested class references.
            </p>
            <div className="mt-6 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{classes.length} defined</span>
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            to="/cards"
            className="group rounded-xl border bg-card p-6 transition hover:border-primary hover:shadow-lg"
          >
            <Layers className="h-8 w-8 text-primary" />
            <h2 className="mt-4 text-lg font-semibold">Cards</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Instantiate data records from your classes and export them.
            </p>
            <div className="mt-6 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{cards.length} created</span>
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
