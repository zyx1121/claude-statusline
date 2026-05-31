import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Globe, KeyRound, ShieldCheck, User } from "lucide-react";
import Markdown from "react-markdown";

import {
  getComponent,
  snapshotIds,
  type Component,
  type ComponentRequires,
} from "@/lib/registry";
import { Preview } from "@/components/ansi";
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
// registry by PR) render on-demand and are revalidated.
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
  return {
    title: `${component.name} — claude-statusline`,
    description: component.description,
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

  const install = `/statusline:install ${component.id}`;
  const github = component.author;

  const networkHosts = component.network;
  const reqBin = asList(component.requires.bin);
  const macos = asList(component.requires.macos);
  const needsNetwork = networkHosts.length > 0;
  const needsSecrets = component.needsSecrets;

  const configEntries = Object.entries(component.configSchema);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:py-16">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All components
      </Link>

      <header className="mt-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {component.name}
          </h1>
          {component.version ? (
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-sm text-muted-foreground">
              v{component.version}
            </code>
          ) : null}
          <TypeBadge type={component.type} />
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
              unknown author
            </span>
          )}
        </div>

        {component.description ? (
          <p className="max-w-prose text-pretty text-base text-muted-foreground">
            {component.description}
          </p>
        ) : null}
      </header>

      {/* Preview — what it actually looks like */}
      {component.preview.trim() ? (
        <section className="mt-8">
          <Preview ansi={component.preview} className="text-xs" />
        </section>
      ) : null}

      {/* Install */}
      <section className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enable this component</CardTitle>
            <CardDescription>
              Run this in Claude Code after installing the plugin to add{" "}
              <code className="font-mono">{component.id}</code> to your active
              profile.
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
        />
      </section>

      {/* Manifest facts */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">Manifest</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything Claude reads before installing — sourced straight from{" "}
          <code className="font-mono">component.json</code>.
        </p>
        <div className="mt-4 rounded-lg border">
          <Table>
            <TableBody>
              <Fact label="Runtime">
                {component.runtime ? (
                  <code className="font-mono">{component.runtime}</code>
                ) : (
                  <Muted>unspecified</Muted>
                )}
              </Fact>

              <Fact label="Type">
                <span>
                  <code className="font-mono">{component.type}</code>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {component.type === "segment"
                      ? "in-process, zero fork"
                      : component.type === "line"
                        ? "forked standalone process"
                        : null}
                  </span>
                </span>
              </Fact>

              <Fact label="Placement">
                {component.placement.slot ? (
                  <span className="font-mono">
                    {component.placement.slot}
                    {typeof component.placement.order === "number"
                      ? ` · order ${component.placement.order}`
                      : ""}
                  </span>
                ) : (
                  <Muted>unspecified</Muted>
                )}
              </Fact>

              <Fact label="Required binaries">
                {reqBin.length > 0 ? (
                  <BadgeList items={reqBin} mono />
                ) : (
                  <Muted>none</Muted>
                )}
              </Fact>

              <Fact label="Network">
                {needsNetwork ? (
                  <BadgeList items={networkHosts} mono variant="secondary" />
                ) : (
                  <Muted>no network</Muted>
                )}
              </Fact>

              <Fact label="macOS only">
                {macos.length > 0 ? (
                  <BadgeList items={macos} mono variant="secondary" />
                ) : (
                  <Muted>no</Muted>
                )}
              </Fact>

              <Fact label="Background fetch">
                {component.hasFetch ? (
                  <Badge variant="secondary">yes</Badge>
                ) : (
                  <Muted>none</Muted>
                )}
              </Fact>

              <Fact label="Secrets / env">
                {needsSecrets ? (
                  <Badge variant="secondary">required</Badge>
                ) : (
                  <Muted>none</Muted>
                )}
              </Fact>
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Config schema */}
      {configEntries.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">Configuration</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tunable knobs, set per-profile with{" "}
            <code className="font-mono">
              /statusline:configure {component.id}
            </code>
            .
          </p>
          <div className="mt-4 rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Description</TableHead>
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
      {component.readme.trim() ? (
        <section className="mt-12">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">README</h2>
            <Badge variant="outline" className="font-normal">
              written for Claude
            </Badge>
          </div>
          <Separator className="mt-3" />
          <article className="mt-6">
            <Markdown components={markdownComponents}>
              {component.readme}
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

function TypeBadge({ type }: { type: Component["type"] }) {
  const isSegment = type === "segment";
  return (
    <Badge variant={isSegment ? "default" : "secondary"}>
      {isSegment ? "segment" : type === "line" ? "line" : type}
    </Badge>
  );
}

function SafetyBanner({
  needsNetwork,
  needsSecrets,
  hosts,
}: {
  needsNetwork: boolean;
  needsSecrets: boolean;
  hosts: string[];
}) {
  if (!needsNetwork && !needsSecrets) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" />
        <span>
          <span className="font-medium text-foreground">
            No network, no secrets.
          </span>{" "}
          <span className="text-muted-foreground">
            Runs entirely on local session data.
          </span>
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
            <span className="font-medium text-foreground">
              Makes network requests
            </span>{" "}
            {hosts.length > 0 ? (
              <>
                to{" "}
                <code className="font-mono text-foreground">
                  {hosts.join(", ")}
                </code>
              </>
            ) : null}
            . Review the hosts in the manifest below before enabling.
          </span>
        </span>
      ) : null}
      {needsSecrets ? (
        <span className="flex items-start gap-2.5">
          <KeyRound className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">
              Reads secrets from the environment.
            </span>{" "}
            Provide them via <code className="font-mono">/statusline:configure</code>.
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
