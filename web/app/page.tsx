import { Boxes } from "lucide-react";

import {
  getRegistry,
  getOctants,
  getDemo,
  localizedName,
  localizedDescription,
  INSTALL,
  REPO_URL,
} from "@/lib/registry";
import { getDict, getLocale } from "@/lib/i18n";
import { TerminalDemo } from "@/components/ansi";
import { ComponentCard } from "@/components/registry/component-card";
import { Badge } from "@/components/ui/badge";
import { CopyCommand } from "@/components/ui/copy-command";

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
        <p className="max-w-2xl text-pretty text-lg text-foreground/60">
          {t.home.tagline}
        </p>
        <div className="grid gap-2 sm:max-w-xl">
          <CopyCommand value={INSTALL.marketplace} />
          <CopyCommand value={INSTALL.plugin} />
          <CopyCommand value={INSTALL.setup} />
        </div>
        <p className="text-sm text-foreground/60">
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
              <Boxes className="size-4 text-foreground/60" />
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
              <span className="text-xs text-foreground/60">
                {group.components.length}{" "}
                {group.components.length === 1 ? t.home.component : t.home.components}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {group.components.map((c) => (
                <ComponentCard
                  key={`${c.repo}/${c.id}`}
                  view={{
                    href: `/c/${c.id}`,
                    name: localizedName(c, locale),
                    description: localizedDescription(c, locale),
                    type: c.type,
                    typeLabels: {
                      segment: t.badges.segment,
                      line: t.badges.line,
                    },
                    runtime: c.runtime,
                    preview: c.preview,
                    frames: c.frames,
                    mosaic: c.mosaic,
                    octants,
                    badges: {
                      network: t.badges.network,
                      offline: t.badges.offline,
                      secrets: t.badges.secrets,
                      fetch: t.badges.fetch,
                    },
                    hasNetwork: c.network.length > 0,
                    needsSecrets: c.needsSecrets,
                    hasFetch: c.hasFetch,
                    noPreviewLabel: t.home.noPreview,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
