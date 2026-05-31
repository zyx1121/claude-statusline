import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Globe, KeyRound, ShieldCheck, User } from "lucide-react";
import Markdown from "react-markdown";

import {
  getComponent,
  getOctants,
  snapshotIds,
  localizedName,
  localizedDescription,
  localizedReadme,
  type Component,
} from "@/lib/registry";
import { getDict, getLocale, type Dict } from "@/lib/i18n";
import { MosaicPreview, AnimatedPreview } from "@/components/ansi";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CopyButton } from "@/components/copy-button";

// Built-ins are pre-rendered from the snapshot; federated components (added to the
// registry by PR) render on-demand and are revalidated. The locale cookie makes
// rendering dynamic per request.
export const dynamicParams = true;
export const revalidate = 600;

export function generateStaticParams() {
  return snapshotIds().map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const component = await getComponent(id);
  if (!component) return { title: "Not found — claude-statusline" };
  const locale = await getLocale();
  return {
    title: `${localizedName(component, locale)} — claude-statusline`,
    description: localizedDescription(component, locale),
  };
}

export default async function ComponentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const component = await getComponent(id);
  if (!component) notFound();

  const locale = await getLocale();
  const t = getDict(locale);

  const install = `/statusline:install ${component.id}`;
  const github = component.author;

  const networkHosts = component.network;
  const reqBin = asList(component.requires.bin);
  const macos = asList(component.requires.macos);
  const needsNetwork = networkHosts.length > 0;
  const needsSecrets = component.needsSecrets;

  const configEntries = Object.entries(component.configSchema);

  return (
    <main className="w-full py-10 lg:py-16">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t.detail.back}
      </Link>

      <header className="mt-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {localizedName(component, locale)}
          </h1>
          {component.version ? (
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-sm text-muted-foreground">
              v{component.version}
            </code>
          ) : null}
          <TypeBadge type={component.type} t={t} />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {github ? (
            <a
              href={`https://github.com/${github}`}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <User className="size-4" />@{github}
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <User className="size-4" />
              {t.detail.unknownAuthor}
            </span>
          )}
        </div>

        {localizedDescription(component, locale) ? (
          <p className="max-w-prose text-pretty text-base text-muted-foreground">
            {localizedDescription(component, locale)}
          </p>
        ) : null}
      </header>

      {/* Preview — what it actually looks like (animated) */}
      {component.mosaic && component.frames?.length ? (
        <section className="mt-8">
          <MosaicPreview frames={component.frames} octants={getOctants()} px={4} />
        </section>
      ) : component.preview.trim() ? (
        <section className="mt-8">
          <AnimatedPreview frames={component.frames} fallback={component.preview} className="text-xs" />
        </section>
      ) : null}

      {/* Install */}
      <section className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.detail.enableTitle}</CardTitle>
            <CardDescription>
              {t.detail.enableDescPre}{" "}
              <code className="font-mono">{component.id}</code> {t.detail.enableDescPost}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CommandLine value={install} label={`Copy ${install}`} />
          </CardContent>
        </Card>
      </section>

      {/* Safety story */}
      <section className="mt-6">
        <SafetyBanner
          needsNetwork={needsNetwork}
          needsSecrets={needsSecrets}
          hosts={networkHosts}
          t={t}
        />
      </section>

      {/* Manifest facts */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">{t.detail.manifest}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.detail.manifestDesc}{" "}
          <code className="font-mono">component.json</code>.
        </p>
        <div className="mt-4 rounded-lg border">
          <Table>
            <TableBody>
              <Fact label={t.detail.facts.runtime}>
                {component.runtime ? (
                  <code className="font-mono">{component.runtime}</code>
                ) : (
                  <Muted>{t.detail.muted.unspecified}</Muted>
                )}
              </Fact>

              <Fact label={t.detail.facts.type}>
                <span>
                  <code className="font-mono">{component.type}</code>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {component.type === "segment"
                      ? t.detail.typeHint.segment
                      : component.type === "line"
                        ? t.detail.typeHint.line
                        : null}
                  </span>
                </span>
              </Fact>

              <Fact label={t.detail.facts.placement}>
                {component.placement.slot ? (
                  <span className="font-mono">
                    {component.placement.slot}
                    {typeof component.placement.order === "number"
                      ? ` · ${t.detail.muted.order} ${component.placement.order}`
                      : ""}
                  </span>
                ) : (
                  <Muted>{t.detail.muted.unspecified}</Muted>
                )}
              </Fact>

              <Fact label={t.detail.facts.reqBin}>
                {reqBin.length > 0 ? (
                  <BadgeList items={reqBin} mono />
                ) : (
                  <Muted>{t.detail.muted.none}</Muted>
                )}
              </Fact>

              <Fact label={t.detail.facts.network}>
                {needsNetwork ? (
                  <BadgeList items={networkHosts} mono variant="secondary" />
                ) : (
                  <Muted>{t.detail.muted.noNetwork}</Muted>
                )}
              </Fact>

              <Fact label={t.detail.facts.macos}>
                {macos.length > 0 ? (
                  <BadgeList items={macos} mono variant="secondary" />
                ) : (
                  <Muted>{t.detail.muted.no}</Muted>
                )}
              </Fact>

              <Fact label={t.detail.facts.fetch}>
                {component.hasFetch ? (
                  <Badge variant="secondary">{t.detail.muted.yes}</Badge>
                ) : (
                  <Muted>{t.detail.muted.none}</Muted>
                )}
              </Fact>

              <Fact label={t.detail.facts.secrets}>
                {needsSecrets ? (
                  <Badge variant="secondary">{t.detail.muted.required}</Badge>
                ) : (
                  <Muted>{t.detail.muted.none}</Muted>
                )}
              </Fact>
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Config schema */}
      {configEntries.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">{t.detail.config}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.detail.configDescPre}{" "}
            <code className="font-mono">/statusline:configure {component.id}</code>.
          </p>
          <div className="mt-4 rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.detail.configTable.key}</TableHead>
                  <TableHead>{t.detail.configTable.type}</TableHead>
                  <TableHead>{t.detail.configTable.default}</TableHead>
                  <TableHead>{t.detail.configTable.desc}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configEntries.map(([key, field]) => (
                  <TableRow key={key}>
                    <TableCell className="align-top font-mono text-sm">
                      {key}
                    </TableCell>
                    <TableCell className="align-top">
                      <code className="font-mono text-xs text-muted-foreground">
                        {field.enum
                          ? field.enum.map((v) => String(v)).join(" | ")
                          : field.type ?? "—"}
                      </code>
                    </TableCell>
                    <TableCell className="align-top">
                      <code className="font-mono text-xs">
                        {formatDefault(field.default)}
                      </code>
                    </TableCell>
                    <TableCell className="align-top text-sm text-muted-foreground">
                      {field.desc ?? ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}

      {/* README */}
      {localizedReadme(component, locale).trim() ? (
        <section className="mt-12">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">{t.detail.readme}</h2>
            <Badge variant="outline" className="font-normal">
              {t.detail.readmeBadge}
            </Badge>
          </div>
          <Separator className="mt-3" />
          <article className="mt-6">
            <Markdown components={markdownComponents}>
              {localizedReadme(component, locale)}
            </Markdown>
          </article>
        </section>
      ) : null}
    </main>
  );
}

/* ---------- helpers ---------- */

// requires.bin / requires.macos are `string[] | boolean | undefined` in the
// shared model; normalise to a host/cap list for rendering.
function asList(v: string[] | boolean | undefined): string[] {
  return Array.isArray(v) ? v : [];
}

function TypeBadge({ type, t }: { type: Component["type"]; t: Dict }) {
  const isSegment = type === "segment";
  return (
    <Badge variant={isSegment ? "default" : "secondary"}>
      {isSegment ? t.badges.segment : t.badges.line}
    </Badge>
  );
}

function SafetyBanner({
  needsNetwork,
  needsSecrets,
  hosts,
  t,
}: {
  needsNetwork: boolean;
  needsSecrets: boolean;
  hosts: string[];
  t: Dict;
}) {
  if (!needsNetwork && !needsSecrets) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" />
        <span>
          <span className="font-medium text-foreground">{t.detail.safety.noneTitle}</span>{" "}
          <span className="text-muted-foreground">{t.detail.safety.noneBody}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border px-4 py-3 text-sm">
      {needsNetwork ? (
        <span className="flex items-start gap-2.5">
          <Globe className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{t.detail.safety.networkTitle}</span>{" "}
            {hosts.length > 0 ? (
              <>
                {t.detail.safety.networkTo}{" "}
                <code className="font-mono text-foreground">{hosts.join(", ")}</code>
              </>
            ) : null}
            . {t.detail.safety.networkBody}
          </span>
        </span>
      ) : null}
      {needsSecrets ? (
        <span className="flex items-start gap-2.5">
          <KeyRound className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{t.detail.safety.secretsTitle}</span>{" "}
            {t.detail.safety.secretsBodyPre}{" "}
            <code className="font-mono">/statusline:configure</code>.
          </span>
        </span>
      ) : null}
    </div>
  );
}

function CommandLine({ value, label }: { value: string; label?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/40 pl-3 pr-1.5">
      <code className="flex-1 overflow-x-auto whitespace-nowrap py-2 font-mono text-sm">
        <span className="select-none text-muted-foreground">$ </span>
        {value}
      </code>
      <CopyButton value={value} label={label} />
    </div>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <TableRow>
      <TableCell className="w-44 align-top font-medium text-muted-foreground">
        {label}
      </TableCell>
      <TableCell className="align-top">{children}</TableCell>
    </TableRow>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

function BadgeList({
  items,
  mono,
  variant = "outline",
}: {
  items: string[];
  mono?: boolean;
  variant?: "outline" | "secondary" | "default";
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge
          key={item}
          variant={variant}
          className={cn(mono && "font-mono font-normal")}
        >
          {item}
        </Badge>
      ))}
    </div>
  );
}

function formatDefault(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "string") return value === "" ? '""' : value;
  return JSON.stringify(value);
}

/* ---------- markdown (manual prose styling, no typography plugin) ---------- */

const markdownComponents = {
  h1: (props: React.ComponentProps<"h1">) => (
    <h1
      className="mt-8 mb-3 text-2xl font-semibold tracking-tight first:mt-0"
      {...props}
    />
  ),
  h2: (props: React.ComponentProps<"h2">) => (
    <h2 className="mt-8 mb-3 text-xl font-semibold tracking-tight" {...props} />
  ),
  h3: (props: React.ComponentProps<"h3">) => (
    <h3 className="mt-6 mb-2 text-lg font-semibold tracking-tight" {...props} />
  ),
  p: (props: React.ComponentProps<"p">) => (
    <p className="my-3 leading-7 text-muted-foreground" {...props} />
  ),
  a: (props: React.ComponentProps<"a">) => (
    <a
      className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
      target="_blank"
      rel="noreferrer noopener"
      {...props}
    />
  ),
  ul: (props: React.ComponentProps<"ul">) => (
    <ul
      className="my-3 ml-6 list-disc space-y-1.5 text-muted-foreground marker:text-muted-foreground/50"
      {...props}
    />
  ),
  ol: (props: React.ComponentProps<"ol">) => (
    <ol
      className="my-3 ml-6 list-decimal space-y-1.5 text-muted-foreground marker:text-muted-foreground/50"
      {...props}
    />
  ),
  li: (props: React.ComponentProps<"li">) => (
    <li className="leading-7" {...props} />
  ),
  code: (props: React.ComponentProps<"code">) => (
    <code
      className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
      {...props}
    />
  ),
  pre: (props: React.ComponentProps<"pre">) => (
    <pre
      className="my-4 overflow-x-auto rounded-lg border bg-muted/40 p-4 font-mono text-sm leading-relaxed [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-[0.85em]"
      {...props}
    />
  ),
  blockquote: (props: React.ComponentProps<"blockquote">) => (
    <blockquote
      className="my-4 border-l-2 border-border pl-4 italic text-muted-foreground"
      {...props}
    />
  ),
  hr: (props: React.ComponentProps<"hr">) => (
    <hr className="my-8 border-border" {...props} />
  ),
  table: (props: React.ComponentProps<"table">) => (
    <div className="my-4 w-full overflow-x-auto rounded-lg border">
      <table className="w-full text-sm" {...props} />
    </div>
  ),
  th: (props: React.ComponentProps<"th">) => (
    <th
      className="border-b px-3 py-2 text-left font-medium text-foreground"
      {...props}
    />
  ),
  td: (props: React.ComponentProps<"td">) => (
    <td className="border-b px-3 py-2 text-muted-foreground" {...props} />
  ),
};
