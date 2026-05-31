import "server-only";

import snapshot from "./registry.generated.json";

/**
 * Federated registry data layer.
 *
 * The marketplace is federated: registry.json (in the claude-statusline repo)
 * lists SOURCES — each a GitHub repo + path holding one or more components/<id>/.
 * A source repo can carry many components, by any author. At request time we read
 * registry.json + each source straight from GitHub (revalidated), so merging a
 * submission PR updates the site without a redeploy.
 *
 * If the live fetch fails (offline build, GitHub rate limit), we fall back to the
 * committed snapshot of the built-ins — the site always renders.
 */

export type ComponentType = "segment" | "line";

export interface ConfigField {
  type?: string;
  enum?: unknown[];
  default?: unknown;
  desc?: string;
}

export interface ComponentRequires {
  bin?: string[];
  network?: string[];
  macos?: string[];
  env?: string[];
}

export interface Component {
  id: string;
  name: string;
  version: string;
  author: string;
  repo: string;
  ref: string;
  path: string;
  official: boolean;
  description: string;
  type: ComponentType;
  runtime: string;
  hasFetch: boolean;
  network: string[];
  needsSecrets: boolean;
  requires: ComponentRequires;
  configSchema: Record<string, ConfigField>;
  placement: { slot?: string; order?: number };
  readme: string;
  preview: string;
}

export interface Source {
  repo: string;
  ref: string;
  path: string;
  author: string;
  official: boolean;
  description?: string;
}

export interface AuthorGroup {
  author: string;
  official: boolean;
  components: Component[];
}

export interface Registry {
  sources: Source[];
  components: Component[];
  byAuthor: AuthorGroup[];
  live: boolean;
}

export const REPO = "zyx1121/claude-statusline";
export const REPO_URL = `https://github.com/${REPO}`;
export const INSTALL = {
  marketplace: "/plugin marketplace add zyx1121/claude-statusline",
  plugin: "/plugin install statusline@claude-statusline",
  setup: "/statusline:setup",
} as const;

const REGISTRY_RAW = `https://raw.githubusercontent.com/${REPO}/main/registry.json`;
const REVALIDATE = 600;

const asStr = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const asArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const asObj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

function resolveAuthor(raw: unknown, fallback: string): string {
  if (typeof raw === "string") return raw || fallback;
  const o = asObj(raw);
  return asStr(o.github) || asStr(o.name) || asStr(o.email) || fallback;
}

async function ghJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate: REVALIDATE },
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function ghText(url: string): Promise<string> {
  try {
    const res = await fetch(url, { next: { revalidate: REVALIDATE } });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

const rawUrl = (src: Source, file: string): string =>
  `https://raw.githubusercontent.com/${src.repo}/${src.ref}/${src.path}/${file}`;

function toComponent(
  m: Record<string, unknown>,
  src: Source,
  id: string,
  readme: string,
  preview: string,
): Component {
  const requires = asObj(m.requires);
  const caps = asObj(m.capabilities);
  const configSchema = asObj(asObj(m.config).schema) as Record<string, ConfigField>;
  const network = [...new Set([...asArr(requires.network), ...asArr(caps.network)])];
  const secretKey = /(secret|token|api[_-]?key|apikey|password)/i;
  const needsSecrets =
    asArr(requires.env).length > 0 ||
    asArr(caps.env).length > 0 ||
    Object.entries(configSchema).some(
      ([k, f]) => asObj(f).type === "secret" || secretKey.test(k),
    );
  return {
    id: asStr(m.id, id),
    name: asStr(m.name, asStr(m.id, id)),
    version: asStr(m.version),
    author: resolveAuthor(m.author, src.author),
    repo: src.repo,
    ref: src.ref,
    path: src.path,
    official: src.official,
    description: asStr(m.description),
    type: m.type === "line" ? "line" : "segment",
    runtime: asStr(m.runtime),
    hasFetch: typeof m.fetch === "object" && m.fetch !== null,
    network,
    needsSecrets,
    requires: {
      bin: asArr(requires.bin),
      network: asArr(requires.network),
      macos: asArr(requires.macos),
      env: asArr(requires.env),
    },
    configSchema,
    placement: asObj(m.placement) as Component["placement"],
    readme,
    preview,
  };
}

function groupByAuthor(components: Component[]): AuthorGroup[] {
  const map = new Map<string, AuthorGroup>();
  for (const c of components) {
    let g = map.get(c.author);
    if (!g) {
      g = { author: c.author, official: c.official, components: [] };
      map.set(c.author, g);
    }
    g.components.push(c);
  }
  return [...map.values()].sort((a, b) =>
    a.official !== b.official
      ? a.official
        ? -1
        : 1
      : a.author.localeCompare(b.author, "en", { sensitivity: "base" }),
  );
}

function fromSnapshot(): Registry {
  const components = (snapshot.components as Component[])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  return {
    sources: snapshot.sources as Source[],
    components,
    byAuthor: groupByAuthor(components),
    live: false,
  };
}

interface GhContentEntry {
  name: string;
  type: string;
}

let memo: Promise<Registry> | null = null;

export async function getRegistry(): Promise<Registry> {
  if (memo) return memo;
  memo = (async () => {
    const reg = await ghJson<{ sources?: unknown[] }>(REGISTRY_RAW);
    const rawSources = Array.isArray(reg?.sources) ? reg!.sources : [];
    if (!rawSources.length) return fromSnapshot();

    const sources: Source[] = rawSources.map((s) => {
      const o = asObj(s);
      return {
        repo: asStr(o.repo),
        ref: asStr(o.ref, "main"),
        path: asStr(o.path),
        author: asStr(o.author),
        official: o.official === true,
        description: asStr(o.description) || undefined,
      };
    });

    const components: Component[] = [];
    for (const src of sources) {
      if (!src.repo || !src.path) continue;
      const listing = await ghJson<GhContentEntry[]>(
        `https://api.github.com/repos/${src.repo}/contents/${src.path}?ref=${src.ref}`,
      );
      if (!Array.isArray(listing)) continue;
      const ids = listing.filter((e) => e.type === "dir").map((e) => e.name);
      for (const id of ids) {
        const m = await ghJson<Record<string, unknown>>(rawUrl(src, `${id}/component.json`));
        if (!m) continue;
        const [readme, preview] = await Promise.all([
          ghText(rawUrl(src, `${id}/README.md`)),
          ghText(rawUrl(src, `${id}/preview.txt`)),
        ]);
        components.push(toComponent(m, src, id, readme, preview));
      }
    }

    if (!components.length) return fromSnapshot();
    components.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
    return { sources, components, byAuthor: groupByAuthor(components), live: true };
  })();
  return memo;
}

export async function getComponents(): Promise<Component[]> {
  return (await getRegistry()).components;
}

export async function getComponent(id: string): Promise<Component | null> {
  return (await getRegistry()).components.find((c) => c.id === id) ?? null;
}

/** Build-time list of ids for generateStaticParams (snapshot — always available). */
export function snapshotIds(): string[] {
  return (snapshot.components as Component[]).map((c) => c.id);
}

/** The render/fetch authoring contract (CONTRACT.md), for the /spec page. */
export function getContract(): string {
  return asStr((snapshot as { contractMd?: string }).contractMd);
}

export function getMarketplaceMeta() {
  return { name: "statusline", marketplace: "claude-statusline", owner: "zyx1121", repo: REPO };
}
