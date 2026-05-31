import Link from "next/link";
import { Boxes, Radio, ShieldCheck, Wifi, KeyRound } from "lucide-react";

import { getRegistry, INSTALL, REPO_URL, type Component } from "@/lib/registry";
import { Preview } from "@/components/ansi";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/copy-button";

// Federated registry is fetched at request time (revalidated).
export const revalidate = 600;

export default async function Home() {
  const reg = await getRegistry();
  const total = reg.components.length;
  const authors = reg.byAuthor.length;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:py-16">
      <section className="space-y-5">
        <h1 className="font-mono text-3xl font-semibold tracking-tight sm:text-4xl">
          claude-statusline
        </h1>
        <p className="max-w-2xl text-pretty text-lg text-muted-foreground">
          A Claude-native, modular status line for Claude Code. Compose tickers,
          widgets, and segments from a federated marketplace — Claude reads each
          component&apos;s README to vet, install, and tune it for you.
        </p>
        <div className="grid gap-2 sm:max-w-xl">
          <CommandLine value={INSTALL.marketplace} />
          <CommandLine value={INSTALL.plugin} />
          <CommandLine value={INSTALL.setup} />
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground">{total}</span> components from{" "}
          <span className="text-foreground">{authors}</span>{" "}
          {authors === 1 ? "author" : "authors"}
          {reg.live ? "" : " · showing the built-in set"} ·{" "}
          <a className="underline underline-offset-4 hover:no-underline" href={REPO_URL}>
            GitHub
          </a>
        </p>
      </section>

      <section className="mt-14 space-y-12">
        {reg.byAuthor.map((group) => (
          <div key={group.author}>
            <div className="mb-4 flex items-center gap-2.5">
              <Boxes className="size-4 text-muted-foreground" />
              <a
                href={`https://github.com/${group.author}`}
                className="font-mono text-sm font-medium hover:underline"
              >
                @{group.author}
              </a>
              {group.official ? (
                <Badge variant="secondary" className="text-[10px]">
                  official
                </Badge>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {group.components.length}{" "}
                {group.components.length === 1 ? "component" : "components"}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {group.components.map((c) => (
                <ComponentCard key={`${c.repo}/${c.id}`} c={c} />
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

function ComponentCard({ c }: { c: Component }) {
  return (
    <Link href={`/c/${c.id}`} className="group block">
      <Card className="flex h-full flex-col gap-3 p-4 transition-colors hover:border-foreground/30">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm font-medium">{c.name}</span>
          <TypeBadge type={c.type} />
        </div>
        {c.preview.trim() ? (
          <Preview ansi={c.preview} />
        ) : (
          <div className="rounded-md border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground">
            no preview
          </div>
        )}
        <p className="line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          <Badge variant="outline" className="font-mono text-[10px] font-normal">
            {c.runtime}
          </Badge>
          {c.network.length > 0 ? (
            <Badge variant="outline" className="gap-1 text-[10px] font-normal">
              <Wifi className="size-3" /> network
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-[10px] font-normal text-emerald-500/80">
              <ShieldCheck className="size-3" /> offline
            </Badge>
          )}
          {c.needsSecrets ? (
            <Badge variant="outline" className="gap-1 text-[10px] font-normal text-amber-500/80">
              <KeyRound className="size-3" /> secrets
            </Badge>
          ) : null}
          {c.hasFetch ? (
            <Badge variant="outline" className="gap-1 text-[10px] font-normal">
              <Radio className="size-3" /> fetch
            </Badge>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}

function TypeBadge({ type }: { type: Component["type"] }) {
  return (
    <Badge variant={type === "segment" ? "default" : "secondary"} className="text-[10px]">
      {type}
    </Badge>
  );
}

function CommandLine({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/40 pl-3 pr-1.5">
      <code className="flex-1 overflow-x-auto whitespace-nowrap py-2 font-mono text-sm">
        <span className="select-none text-muted-foreground">$ </span>
        {value}
      </code>
      <CopyButton value={value} label={`Copy ${value}`} />
    </div>
  );
}
