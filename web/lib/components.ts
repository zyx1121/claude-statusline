import "server-only";

import fs from "node:fs";
import path from "node:path";

/**
 * Build-time data layer — the single source the pages import.
 *
 * Reads each component's component.json + README.md straight from the plugin
 * repo. web/ lives at <repo>/web, so components resolve to ../plugin/components
 * and the catalog to ../.claude-plugin/marketplace.json. Pure Node fs + path,
 * server-only (RSC / generateStaticParams) — never shipped to the client.
 */

export type ComponentType = "segment" | "line";

export interface ConfigField {
  type?: string;
  /** Present on enum-style knobs (e.g. ratelimit.window). */
  enum?: unknown[];
  default?: unknown;
  desc?: string;
}

export interface ComponentRequires {
  bin?: string[];
  /** Host allow-list, e.g. ["news.google.com"]. */
  network?: string[];
  /** macOS entitlements, e.g. ["AppleEvents"]. */
  macos?: string[];
  /** Forward-compat: required env vars (none today). */
  env?: string[];
}

export interface ComponentPlacement {
  slot?: string;
  order?: number;
}

export interface Component {
  id: string;
  name: string;
  version: string;
  /** Author handle, resolved from author.github / author.name / string. */
  author: string;
  description: string;
  type: ComponentType;
  runtime: string;
  /** Whether the manifest declares a background fetch step. */
  hasFetch: boolean;
  /** Hosts this component contacts, e.g. ["mis.twse.com.tw"]. Empty = offline. */
  network: string[];
  /** True when the component needs secrets / env vars / API keys to work. */
  needsSecrets: boolean;
  requires: ComponentRequires;
  configSchema: Record<string, ConfigField>;
  placement: ComponentPlacement;
  /** Claude-facing README markdown ("" when missing). */
  readme: string;
}

export interface MarketplaceMeta {
  /** The plugin install name, e.g. "statusline". */
  name: string;
  /** The marketplace's own name, e.g. "claude-statusline". */
  marketplace: string;
  description?: string;
  version?: string;
  /** Owner handle, e.g. "zyx1121". */
  owner?: string;
}

const COMPONENTS_DIR = path.join(process.cwd(), "..", "plugin", "components");
const MARKETPLACE_PATH = path.join(
  process.cwd(),
  "..",
  ".claude-plugin",
  "marketplace.json",
);

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
}

/** author is `{ github }` in the real manifests; tolerate a bare string. */
function resolveAuthor(raw: unknown): string {
  if (typeof raw === "string") return raw;
  const o = asObject(raw);
  return asString(o.github) || asString(o.name) || asString(o.email);
}

/**
 * Merge the host lists from requires.network and capabilities.network (the two
 * places the real manifests declare hosts) into a deduped allow-list.
 */
function resolveNetwork(
  requires: ComponentRequires,
  capabilities: Record<string, unknown>,
): string[] {
  const hosts = new Set<string>([
    ...asStringArray(requires.network),
    ...asStringArray(capabilities.network),
  ]);
  return [...hosts];
}

/**
 * needsSecrets: required env vars or an explicit secrets field. No component
 * needs secrets today, but the auth angle matters for the site, so we also flag
 * config keys / capabilities.env that look like a token / api key / secret.
 */
function resolveNeedsSecrets(
  requires: ComponentRequires,
  capabilities: Record<string, unknown>,
  configSchema: Record<string, ConfigField>,
): boolean {
  if (asStringArray(requires.env).length > 0) return true;
  if (asStringArray(capabilities.env).length > 0) return true;

  const secretKey = /(secret|token|api[_-]?key|apikey|password)/i;
  for (const [key, field] of Object.entries(configSchema)) {
    if (field?.type === "secret") return true;
    if (secretKey.test(key)) return true;
  }
  return false;
}

function readComponent(dir: string): Component | null {
  const componentDir = path.join(COMPONENTS_DIR, dir);
  const manifest = readJson<Record<string, unknown>>(
    path.join(componentDir, "component.json"),
  );
  if (!manifest) return null;

  const requires = asObject(manifest.requires) as ComponentRequires;
  const capabilities = asObject(manifest.capabilities);
  const placement = asObject(manifest.placement) as ComponentPlacement;
  const hasFetch =
    typeof manifest.fetch === "object" && manifest.fetch !== null;

  // config.schema is the source of truth (config may also carry e.g. `file`).
  const config = asObject(manifest.config);
  const configSchema = asObject(config.schema) as Record<string, ConfigField>;

  let readme = "";
  const readmePath = path.join(componentDir, "README.md");
  if (fs.existsSync(readmePath)) {
    try {
      readme = fs.readFileSync(readmePath, "utf8");
    } catch {
      readme = "";
    }
  }

  const type: ComponentType = manifest.type === "line" ? "line" : "segment";

  return {
    id: asString(manifest.id, dir),
    name: asString(manifest.name, asString(manifest.id, dir)),
    version: asString(manifest.version),
    author: resolveAuthor(manifest.author),
    description: asString(manifest.description),
    type,
    runtime: asString(manifest.runtime),
    hasFetch,
    network: resolveNetwork(requires, capabilities),
    needsSecrets: resolveNeedsSecrets(requires, capabilities, configSchema),
    requires,
    configSchema,
    placement,
    readme,
  };
}

let cache: Component[] | null = null;

export function getComponents(): Component[] {
  if (cache) return cache;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(COMPONENTS_DIR, { withFileTypes: true });
  } catch {
    cache = [];
    return cache;
  }

  cache = entries
    .filter((e) => e.isDirectory())
    .map((e) => readComponent(e.name))
    .filter((c): c is Component => c !== null)
    .sort((a, b) =>
      a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
    );

  return cache;
}

export function getComponent(id: string): Component | null {
  return getComponents().find((c) => c.id === id) ?? null;
}

export function getMarketplaceMeta(): MarketplaceMeta {
  const raw = readJson<Record<string, unknown>>(MARKETPLACE_PATH) ?? {};
  const meta = asObject(raw.metadata);
  const ownerObj = asObject(raw.owner);

  const marketplace = asString(raw.name, "claude-statusline");
  let name = marketplace;
  let description =
    asString(meta.description) || asString(raw.description) || undefined;
  let version = asString(meta.version) || asString(raw.version) || undefined;

  const owner =
    asString(ownerObj.name) ||
    // owner.url is e.g. https://github.com/zyx1121 -> take the handle.
    asString(ownerObj.url).split("/").filter(Boolean).pop() ||
    asString(raw.owner) ||
    undefined;

  // The install name is the plugins[] entry named "statusline".
  const plugins = Array.isArray(raw.plugins) ? raw.plugins : [];
  const match =
    plugins.find((p) => asString(asObject(p).name) === "statusline") ??
    plugins[0];
  if (match) {
    const m = asObject(match);
    name = asString(m.name, name);
    description = asString(m.description) || description;
    version = asString(m.version) || version;
  }

  return {
    name: name || "statusline",
    marketplace,
    description,
    version,
    owner,
  };
}
