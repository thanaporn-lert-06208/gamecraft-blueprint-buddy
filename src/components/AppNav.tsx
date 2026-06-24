import { Link } from "@tanstack/react-router";
import { Boxes, Layers } from "lucide-react";

export function AppNav() {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            GF
          </span>
          <span>GameFlow Forge</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            to="/classes"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
            activeProps={{ className: "flex items-center gap-2 rounded-md px-3 py-2 text-sm bg-accent text-foreground font-medium" }}
          >
            <Boxes className="h-4 w-4" /> Classes
          </Link>
          <Link
            to="/cards"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
            activeProps={{ className: "flex items-center gap-2 rounded-md px-3 py-2 text-sm bg-accent text-foreground font-medium" }}
          >
            <Layers className="h-4 w-4" /> Cards
          </Link>
        </nav>
      </div>
    </header>
  );
}
