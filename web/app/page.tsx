import Link from "next/link";
import {
  ArrowUpRight,
  Boxes,
  KeyRound,
  Layers,
  ScanSearch,
  Terminal,
  Wifi,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { getComponents, type Component } from "@/lib/components";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyButton } from "@/components/copy-button";

const INSTALL_STEPS = [
  {
    cmd: "/plugin marketplace add zyx1121/claude-statusline",
    note: "Add the marketplace",
  },
  {
    cmd: "/plugin install statusline@claude-statusline",
    note: "Install the plugin",
  },
  {
    cmd: "/statusline:setup",
    note: "Wire it into your status line",
  },
] as const;

function TypeBadge({ type }: { type: Component["type"] }) {
  const isLine = type === "line";
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-mono text-[10px] uppercase tracking-wide",
        isLine
          ? "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300"
          : "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300",
      )}
    >
      {type}
    </Badge>
  );
}

function MetaBadge({
  icon: Icon,
  children,
  className,
}: {
  icon: typeof Wifi;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-3" />
      {children}
    </span>
  );
}

function ComponentCard({ component }: { component: Component }) {
  const hasNetwork = component.network.length > 0;

  return (
    <Link
      href={`/c/${component.id}`}
      className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card className="h-full gap-3 transition-colors hover:border-foreground/20 hover:bg-muted/30">
        <CardHeader className="gap-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 font-mono text-base">
              {component.name}
              <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </CardTitle>
            <TypeBadge type={component.type} />
          </div>
          {component.description ? (
            <CardDescription className="line-clamp-2">
              {component.description}
            </CardDescription>
          ) : null}
        </CardHeader>

        <div className="mt-auto flex flex-wrap items-center gap-1.5 px-6 pb-1">
          {component.runtime ? (
            <MetaBadge icon={Terminal}>{component.runtime}</MetaBadge>
          ) : null}
          {hasNetwork ? (
            <MetaBadge
              icon={Wifi}
              className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300"
            >
              network
            </MetaBadge>
          ) : null}
          {component.needsSecrets ? (
            <MetaBadge
              icon={KeyRound}
              className="border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300"
            >
              secrets
            </MetaBadge>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}

const CONCEPTS = [
  {
    icon: Boxes,
    title: "Component",
    body: "A single widget — a segment inline in the bar, or a full line of its own. Each ships its render + manifest.",
  },
  {
    icon: Layers,
    title: "Profile",
    body: "A template that composes components into a layout. Swap profiles to reshape your whole status line.",
  },
  {
    icon: ScanSearch,
    title: "Claude-vetted",
    body: "Every component ships a README written for Claude to read, vet, and install — no blind copy-paste.",
  },
] as const;

export default function HomePage() {
  const components = getComponents();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-24">
      {/* Hero */}
      <section className="flex flex-col items-start gap-6">
        <Badge
          variant="outline"
          className="gap-1.5 font-mono text-[11px] text-muted-foreground"
        >
          <Terminal className="size-3" />
          Claude Code plugin
        </Badge>

        <div className="space-y-3">
          <h1 className="font-mono text-4xl font-semibold tracking-tight sm:text-5xl">
            claude-statusline
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            A Claude-native, modular status line for Claude Code. Compose it from
            small components — each one ships a README written for Claude to read,
            vet, and install.
          </p>
        </div>

        {/* Install block */}
        <div className="w-full max-w-2xl overflow-hidden rounded-lg border bg-card">
          <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-full bg-rose-500/70" />
            <span className="size-2.5 rounded-full bg-amber-500/70" />
            <span className="size-2.5 rounded-full bg-emerald-500/70" />
            <span className="ml-2 font-mono">install</span>
          </div>
          <div className="divide-y divide-border/60">
            {INSTALL_STEPS.map((step) => (
              <div
                key={step.cmd}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <div className="flex min-w-0 flex-col">
                  <code className="truncate font-mono text-sm text-foreground">
                    <span className="select-none text-muted-foreground">
                      ${" "}
                    </span>
                    {step.cmd}
                  </code>
                  <span className="text-[11px] text-muted-foreground">
                    {step.note}
                  </span>
                </div>
                <CopyButton value={step.cmd} />
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Enable a specific component with{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
            /statusline:install &lt;id&gt;
          </code>
          .
        </p>
      </section>

      {/* Components grid */}
      <section className="mt-20">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Components</h2>
          <span className="font-mono text-sm text-muted-foreground">
            {components.length} available
          </span>
        </div>

        {components.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {components.map((component) => (
              <ComponentCard key={component.id} component={component} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No components found.</p>
        )}
      </section>

      {/* Concepts strip */}
      <section className="mt-20">
        <h2 className="mb-6 text-xl font-semibold tracking-tight">
          How it fits together
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {CONCEPTS.map((concept) => (
            <Card key={concept.title} className="gap-2 bg-muted/20">
              <CardHeader className="gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg border bg-background text-foreground">
                  <concept.icon className="size-4" />
                </div>
                <CardTitle className="text-base">{concept.title}</CardTitle>
                <CardDescription>{concept.body}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
