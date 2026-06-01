import Link from "next/link";
import { Boxes, Radio, ShieldCheck, Wifi, KeyRound } from "lucide-react";

import {
  getRegistry,
  getOctants,
  getDemo,
  localizedName,
  localizedDescription,
  INSTALL,
  REPO_URL,
  type Component,
} from "@/lib/registry";
import { getDict, getLocale, type Dict, type Locale } from "@/lib/i18n";
import { MosaicPreview, AnimatedPreview, TerminalDemo } from "@/components/ansi";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/copy-button";

// Federated registry is fetched at request time (revalidated).
export const revalidate = 600;

export default async function Home() {
  const locale = await getLocale();
  const t = getDict(locale);
  const reg = await getRegistry();
  const octants = getOctants();
  const demo = getDemo();
  const total = reg.components.length;
  const authors = reg.byAuthor.length;

  return (
    <main className="w-full py-12 lg:py-16">
      <section className="space-y-5">
        <h1 className="font-mono text-3xl font-semibold tracking-tight sm:text-4xl">
          claude-statusline
        </h1>
        <p className="max-w-2xl text-pretty text-lg text-muted-foreground">
          {t.home.tagline}
        </p>
        <div className="grid gap-2 sm:max-w-xl">
          <CommandLine value={INSTALL.marketplace} />
          <CommandLine value={INSTALL.plugin} />
          <CommandLine value={INSTALL.setup} />
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground">{t.home.statsComponents(total)}</span>{" "}
          {t.home.statsFrom}{" "}
          <span className="text-foreground">{t.home.statsAuthors(authors)}</span>
          {reg.live ? "" : ` · ${t.home.builtinNote}`} ·{" "}
          <a className="underline underline-offset-4 hover:no-underline" href={REPO_URL}>
            GitHub
          </a>
        </p>
      </section>

      {demo ? (
        <section className="mt-10">
          <TerminalDemo frames={demo.frames} octants={octants} cols={demo.cols} />
        </section>
      ) : null}

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
                  {t.badges.official}
                </Badge>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {group.components.length}{" "}
                {group.components.length === 1 ? t.home.component : t.home.components}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {group.components.map((c) => (
                <ComponentCard
                  key={`${c.repo}/${c.id}`}
                  c={c}
                  octants={octants}
                  t={t}
                  locale={locale}
                />
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

function ComponentCard({
  c,
  octants,
  t,
  locale,
}: {
  c: Component;
  octants: string;
  t: Dict;
  locale: Locale;
}) {
  return (
    <Link href={`/c/${c.id}`} className="group block">
      <Card className="flex h-full flex-col gap-3 p-4 transition-colors hover:border-foreground/30">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm font-medium">{localizedName(c, locale)}</span>
          <TypeBadge type={c.type} t={t} />
        </div>
        {c.mosaic && c.frames?.length ? (
          <MosaicPreview frames={c.frames} octants={octants} />
        ) : c.preview.trim() ? (
          <AnimatedPreview frames={c.frames} fallback={c.preview} />
        ) : (
          <div className="rounded-md border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground">
            {t.home.noPreview}
          </div>
        )}
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {localizedDescription(c, locale)}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          <Badge variant="outline" className="font-mono text-[10px] font-normal">
            {c.runtime}
          </Badge>
          {c.network.length > 0 ? (
            <Badge variant="outline" className="gap-1 text-[10px] font-normal">
              <Wifi className="size-3" /> {t.badges.network}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-[10px] font-normal text-emerald-500/80">
              <ShieldCheck className="size-3" /> {t.badges.offline}
            </Badge>
          )}
          {c.needsSecrets ? (
            <Badge variant="outline" className="gap-1 text-[10px] font-normal text-amber-500/80">
              <KeyRound className="size-3" /> {t.badges.secrets}
            </Badge>
          ) : null}
          {c.hasFetch ? (
            <Badge variant="outline" className="gap-1 text-[10px] font-normal">
              <Radio className="size-3" /> {t.badges.fetch}
            </Badge>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}

function TypeBadge({ type, t }: { type: Component["type"]; t: Dict }) {
  return (
    <Badge variant={type === "segment" ? "default" : "secondary"} className="text-[10px]">
      {type === "segment" ? t.badges.segment : t.badges.line}
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
