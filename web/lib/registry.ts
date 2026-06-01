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
  /** Localized display name/description per locale (English stays in name/description). */
  i18n?: Record<string, { name?: string; description?: string }>;
  /** Per-locale README markdown (en = source-of-truth). Missing/"" falls back to readme. */
  readmes?: Record<string, string>;
  preview: string;
  /** Animation frames (line widgets) — cycled ~1/s in the UI; absent for static parts. */
  frames?: string[];
  /** Uses octant/block glyphs → render via the pixel decoder, not as text. */
  mosaic?: boolean;
}

export interface ProfileInstance {
  id: string;
  slot?: string;
  order?: number;
  config?: Record<string, unknown>;
}

/** A profile = a named composition of component instances placed into slots. */
export interface Profile {
  name: string;
  description?: string;
  rule?: boolean;
  side_effects?: string[];
  components: ProfileInstance[];
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
  profiles: Profile[];
  live: boolean;
}

/** Pick the localized display name / description / README, falling back to English. */
export function localizedName(c: Component, locale: string): string {
  return c.i18n?.[locale]?.name?.trim() || c.name;
}
export function localizedDescription(c: Component, locale: string): string {
  return c.i18n?.[locale]?.description?.trim() || c.description;
}
export function localizedReadme(c: Component, locale: string): string {
  const r = c.readmes?.[locale];
  return (r && r.trim() ? r : c.readme) || "";
}

export const REPO = "zyx1121/claude-statusline";
export const REPO_URL = `https://github.com/${REPO}`;
export const SITE_URL = "https://claude-statusline.vercel.app";
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
  readmes?: Record<string, string>,
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
    i18n: asObj(m.i18n) as Component["i18n"],
    readme,
    readmes: readmes ?? { en: readme },
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

// The JSON import widens `type` to string; the snapshot is produced by our own
// snapshot.mjs against the same shape, so assert it back to Component[].
const SNAPSHOT_COMPONENTS = snapshot.components as unknown as Component[];

const SNAPSHOT_PROFILES = ((snapshot as { profiles?: unknown }).profiles ?? []) as Profile[];

function fromSnapshot(): Registry {
  const components = SNAPSHOT_COMPONENTS.slice().sort((a, b) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
  );
  return {
    sources: snapshot.sources as Source[],
    components,
    byAuthor: groupByAuthor(components),
    profiles: SNAPSHOT_PROFILES,
    live: false,
  };
}

interface GhContentEntry {
  name: string;
  type: string;
}

/** GitHub's listing for a source repo path — directory names only. */
async function listSourceIds(src: Source): Promise<string[]> {
  const listing = await ghJson<GhContentEntry[]>(
    `https://api.github.com/repos/${src.repo}/contents/${src.path}?ref=${src.ref}`,
  );
  return Array.isArray(listing)
    ? listing.filter((e) => e.type === "dir").map((e) => e.name)
    : [];
}

async function fetchOneComponent(src: Source, id: string): Promise<Component | null> {
  const m = await ghJson<Record<string, unknown>>(rawUrl(src, `${id}/component.json`));
  if (!m) return null;
  const [readme, preview, rHant, rHans] = await Promise.all([
    ghText(rawUrl(src, `${id}/README.md`)),
    ghText(rawUrl(src, `${id}/preview.txt`)),
    ghText(rawUrl(src, `${id}/README.zh-Hant.md`)),
    ghText(rawUrl(src, `${id}/README.zh-Hans.md`)),
  ]);
  return toComponent(m, src, id, readme, preview, {
    en: readme,
    "zh-Hant": rHant,
    "zh-Hans": rHans,
  });
}

let memo: Promise<Registry> | null = null;

/**
 * Snapshot is AUTHORITATIVE for the official built-ins — it's committed, complete,
 * and never rate-limited, so the core set always renders correctly. We then try to
 * ADD third-party sources from the live registry on a best-effort basis (the
 * unauthenticated GitHub API is 60 req/hr per IP — fine for the occasional extra
 * source, not for refetching the whole built-in set on every ISR pass). A registry
 * PR that adds built-ins is reflected on the next deploy via the snapshot; external
 * sources show up live without a redeploy.
 */
export async function getRegistry(): Promise<Registry> {
  if (memo) return memo;
  memo = (async () => {
    const base = fromSnapshot();
    const snapshotPaths = new Set(base.sources.map((s) => `${s.repo}@${s.path}`));
    const haveIds = new Set(base.components.map((c) => c.id));

    const reg = await ghJson<{ sources?: unknown[] }>(REGISTRY_RAW);
    const rawSources = Array.isArray(reg?.sources) ? reg!.sources : [];
    const extraSources: Source[] = rawSources
      .map((s) => {
        const o = asObj(s);
        return {
          repo: asStr(o.repo),
          ref: asStr(o.ref, "main"),
          path: asStr(o.path),
          author: asStr(o.author),
          official: o.official === true,
          description: asStr(o.description) || undefined,
        };
      })
      .filter((s) => s.repo && s.path && !snapshotPaths.has(`${s.repo}@${s.path}`));

    const added: Component[] = [];
    const sources = [...base.sources];
    let live = false;
    for (const src of extraSources) {
      const ids = await listSourceIds(src);
      if (!ids.length) continue;
      sources.push(src);
      for (const id of ids) {
        if (haveIds.has(id)) continue; // first writer wins; never shadow a built-in
        const c = await fetchOneComponent(src, id);
        if (c) {
          haveIds.add(id);
          added.push(c);
          live = true;
        }
      }
    }

    const components = [...base.components, ...added].sort((a, b) =>
      a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
    );
    return { sources, components, byAuthor: groupByAuthor(components), profiles: base.profiles, live };
  })();
  return memo;
}

export async function getProfiles(): Promise<Profile[]> {
  return (await getRegistry()).profiles;
}

export async function getProfile(name: string): Promise<Profile | null> {
  return (await getRegistry()).profiles.find((p) => p.name === name) ?? null;
}

export async function getComponents(): Promise<Component[]> {
  return (await getRegistry()).components;
}

export async function getComponent(id: string): Promise<Component | null> {
  return (await getRegistry()).components.find((c) => c.id === id) ?? null;
}

/** Build-time list of ids for generateStaticParams (snapshot — always available). */
export function snapshotIds(): string[] {
  return SNAPSHOT_COMPONENTS.map((c) => c.id);
}

/** Build-time list of profile names for generateStaticParams (install routes). */
export function snapshotProfileNames(): string[] {
  return SNAPSHOT_PROFILES.map((p) => p.name);
}

/** The render/fetch authoring contract (CONTRACT.md), for the /spec page. */
export function getContract(): string {
  return asStr((snapshot as { contractMd?: string }).contractMd);
}

/** The 256-entry octant table — the pixel decoder inverts it to draw mosaic frames. */
export function getOctants(): string {
  return asStr((snapshot as { octants?: string }).octants);
}

export interface Demo {
  cols: number;
  frames: string[];
}

/** Captured full-profile loader frames for the home-page terminal demo. */
export function getDemo(): Demo | null {
  const d = (snapshot as { demo?: unknown }).demo;
  const o = asObj(d);
  const frames = Array.isArray(o.frames) ? (o.frames as string[]) : [];
  if (!frames.length) return null;
  return { cols: typeof o.cols === "number" ? o.cols : 80, frames };
}

export function getMarketplaceMeta() {
  return { name: "statusline", marketplace: "claude-statusline", owner: "zyx1121", repo: REPO };
}
