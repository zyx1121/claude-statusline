import type { Metadata } from "next";
import type { ComponentProps } from "react";
import Markdown, { type Components } from "react-markdown";
import { FileJson, FileText, Terminal, GitPullRequest } from "lucide-react";
import { Surface } from "@/components/blocks/surface";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getContract } from "@/lib/registry";
import { getDict, getLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Writing a component · claude-statusline",
  description:
    "The authoring spec for claude-statusline components: directory shape, segment vs line, the render/fetch contract, and how to contribute one.",
};

const SPEC_TREE_URL =
  "https://github.com/zyx1121/claude-statusline/tree/main/plugin/spec";
const COMPONENT_SCHEMA_URL =
  "https://github.com/zyx1121/claude-statusline/blob/main/plugin/spec/component.schema.json";
const PROFILE_SCHEMA_URL =
  "https://github.com/zyx1121/claude-statusline/blob/main/plugin/spec/profile.schema.json";

// Read the contract at build time — live from ../plugin when present (dev), else
// from the committed snapshot (Vercel, where ../plugin isn't uploaded).
function readContract(): string {
  return getContract();
}

const DIR_SHAPE = `plugin/components/<id>/
├── component.json     # manifest — identity, contract, config, placement
├── README.md          # Claude-facing doc: what it shows, what it needs, how to vet
├── render.sh          # render entry (segment: in-process bash) — or render.py
└── fetch.sh           # optional: background data fetch (network / expensive work)`;

// Explicit renderers so the embedded contract is styled without depending on a
// Tailwind typography plugin being wired into the build.
const markdownComponents: Components = {
  h1: ({ className, ...props }: ComponentProps<"h1">) => (
    <h1
      className={cn(
        "mt-10 mb-4 text-2xl font-semibold tracking-tight first:mt-0",
        className,
      )}
      {...props}
    />
  ),
  h2: ({ className, ...props }: ComponentProps<"h2">) => (
    <h2
      className={cn(
        "mt-10 mb-3 pb-2 text-xl font-semibold tracking-tight",
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }: ComponentProps<"h3">) => (
    <h3
      className={cn("mt-6 mb-2 text-base font-semibold tracking-tight", className)}
      {...props}
    />
  ),
  h4: ({ className, ...props }: ComponentProps<"h4">) => (
    <h4
      className={cn("mt-5 mb-2 text-sm font-semibold tracking-tight", className)}
      {...props}
    />
  ),
  p: ({ className, ...props }: ComponentProps<"p">) => (
    <p
      className={cn("my-4 leading-relaxed text-foreground/90", className)}
      {...props}
    />
  ),
  ul: ({ className, ...props }: ComponentProps<"ul">) => (
    <ul
      className={cn("my-4 list-disc space-y-1.5 pl-6 text-foreground/90", className)}
      {...props}
    />
  ),
  ol: ({ className, ...props }: ComponentProps<"ol">) => (
    <ol
      className={cn(
        "my-4 list-decimal space-y-1.5 pl-6 text-foreground/90",
        className,
      )}
      {...props}
    />
  ),
  li: ({ className, ...props }: ComponentProps<"li">) => (
    <li className={cn("leading-relaxed", className)} {...props} />
  ),
  a: ({ className, ...props }: ComponentProps<"a">) => (
    <a
      className={cn(
        "font-medium text-foreground underline underline-offset-4 hover:text-foreground/80",
        className,
      )}
      target="_blank"
      rel="noreferrer noopener"
      {...props}
    />
  ),
  strong: ({ className, ...props }: ComponentProps<"strong">) => (
    <strong className={cn("font-semibold text-foreground", className)} {...props} />
  ),
  blockquote: ({ className, ...props }: ComponentProps<"blockquote">) => (
    <blockquote
      className={cn(
        "my-4 border-l-2 border-foreground/20 pl-4 text-foreground/60 italic",
        className,
      )}
      {...props}
    />
  ),
  hr: ({ className, ...props }: ComponentProps<"hr">) => (
    <hr className={cn("my-8 border-foreground/10", className)} {...props} />
  ),
  pre: ({ className, ...props }: ComponentProps<"pre">) => (
    <pre
      className={cn(
        "corner-token my-4 overflow-x-auto rounded-xl bg-block p-4 font-mono text-xs leading-relaxed text-foreground/90",
        className,
      )}
      {...props}
    />
  ),
  code: ({ className, ...props }: ComponentProps<"code">) => {
    // Block code is wrapped in <pre>; inline code carries no language class.
    const isInline = !/\blanguage-/.test(className ?? "");
    return (
      <code
        className={cn(
          isInline &&
            "rounded-md bg-block px-1.5 py-0.5 font-mono text-[0.85em] text-foreground",
          className,
        )}
        {...props}
      />
    );
  },
  table: ({ className, ...props }: ComponentProps<"table">) => (
    <div className="my-4 overflow-x-auto">
      <table
        className={cn("w-full border-collapse text-sm", className)}
        {...props}
      />
    </div>
  ),
  th: ({ className, ...props }: ComponentProps<"th">) => (
    <th
      className={cn(
        "border border-foreground/10 bg-block px-3 py-2 text-left font-medium",
        className,
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }: ComponentProps<"td">) => (
    <td
      className={cn("border border-foreground/10 px-3 py-2 align-top", className)}
      {...props}
    />
  ),
};

export default async function SpecPage() {
  const contract = readContract();
  const locale = await getLocale();
  const t = getDict(locale);

  return (
    <main className="w-full py-12 sm:py-16">
      <header className="mb-10">
        <Badge variant="outline" className="mb-3 font-mono">
          {t.spec.badge}
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t.spec.title}
        </h1>
        <p className="mt-3 max-w-2xl text-foreground/60">{t.spec.intro}</p>
      </header>

      {/* Directory shape */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold tracking-tight">
          <FileJson className="size-5 text-foreground/60" />
          {t.spec.dirShape}
        </h2>
        <p className="mb-4 text-sm text-foreground/60">
          Everything lives under{" "}
          <code className="rounded-md bg-block px-1.5 py-0.5 font-mono text-xs">
            plugin/components/&lt;id&gt;/
          </code>
          . The manifest declares identity and contract, the README is the trust
          surface, and the render entry produces the actual output.
        </p>
        <pre className="corner-token overflow-x-auto rounded-xl bg-block p-4 font-mono text-xs leading-relaxed text-foreground/90">
          {DIR_SHAPE}
        </pre>
      </section>

      {/* Segment vs line */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Terminal className="size-5 text-foreground/60" />
          {t.spec.segmentVsLine}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Surface size="sm">
            <Badge variant="secondary" className="mb-2 font-mono">
              segment
            </Badge>
            <p className="text-sm text-foreground/60">
              Renders <strong className="text-foreground">in-process</strong>:
              fast, synchronous bash that prints one chunk of text. The default
              choice — a clock, a git branch, a context gauge.
            </p>
          </Surface>
          <Surface size="sm">
            <Badge variant="secondary" className="mb-2 font-mono">
              line
            </Badge>
            <p className="text-sm text-foreground/60">
              Forks a <strong className="text-foreground">widget</strong>: its
              own process, so it can be Python, do async work, or animate. Use
              it when a segment&apos;s in-process budget is too tight.
            </p>
          </Surface>
        </div>
      </section>

      {/* render / fetch contract */}
      <section className="mb-12">
        <h2 className="mb-4 text-xl font-semibold tracking-tight">
          {t.spec.contract}
        </h2>
        <dl className="space-y-4 text-sm">
          <Surface size="sm">
            <dt className="mb-1 font-mono font-medium">render</dt>
            <dd className="text-foreground/60">
              The status JSON arrives on{" "}
              <code className="rounded-md bg-background px-1 py-0.5 font-mono text-xs">
                stdin
              </code>
              ; declared inputs are exported as environment variables. Write the
              rendered output to{" "}
              <code className="rounded-md bg-background px-1 py-0.5 font-mono text-xs">
                stdout
              </code>{" "}
              (ANSI allowed), keep it to a single line, and exit fast.
            </dd>
          </Surface>
          <Surface size="sm">
            <dt className="mb-1 font-mono font-medium">fetch</dt>
            <dd className="text-foreground/60">
              Optional. Runs out of band on its own cadence to do the
              network-bound or expensive work, caching the result so{" "}
              <code className="rounded-md bg-background px-1 py-0.5 font-mono text-xs">
                render
              </code>{" "}
              stays cheap. Anything that touches the network or secrets belongs
              here, declared in the manifest&apos;s capabilities.
            </dd>
          </Surface>
        </dl>
        <p className="mt-4 text-sm text-foreground/60">
          The full normative contract is below. The JSON schemas are the source
          of truth for the manifest and profile shapes:{" "}
          <a
            href={COMPONENT_SCHEMA_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/80"
          >
            component.schema.json
          </a>{" "}
          and{" "}
          <a
            href={PROFILE_SCHEMA_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/80"
          >
            profile.schema.json
          </a>
          .
        </p>
      </section>

      {/* Contributing */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold tracking-tight">
          <GitPullRequest className="size-5 text-foreground/60" />
          {t.spec.contributing}
        </h2>
        <p className="text-sm text-foreground/60">
          A new component is a pull request that adds a single{" "}
          <code className="rounded-md bg-block px-1.5 py-0.5 font-mono text-xs">
            plugin/components/&lt;id&gt;/
          </code>{" "}
          directory. Match the contract below, validate against the schemas in{" "}
          <a
            href={SPEC_TREE_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/80"
          >
            plugin/spec/
          </a>
          , and write the README so Claude can read it, understand the trust
          surface, and install it.
        </p>
        <p className="mt-4 text-sm text-foreground/60">
          Once the directory lands, anyone can enable it in their active profile
          with{" "}
          <code className="rounded-md bg-block px-1.5 py-0.5 font-mono text-xs">
            /statusline:install &lt;id&gt;
          </code>
          .
        </p>
      </section>

      {/* Full contract */}
      <section>
        <div className="mb-6 flex items-center gap-2">
          <FileText className="size-5 text-foreground/60" />
          <h2 className="text-xl font-semibold tracking-tight">
            CONTRACT.md
          </h2>
          <a
            href={SPEC_TREE_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="ml-auto text-xs text-foreground/60 underline underline-offset-4 hover:text-foreground"
          >
            {t.spec.viewSource}
          </a>
        </div>
        <article className="max-w-none text-sm text-foreground/90">
          <Markdown components={markdownComponents}>{contract}</Markdown>
        </article>
      </section>
    </main>
  );
}
