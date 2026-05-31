// Snapshot the local plugin's components into web/lib/registry.generated.json — an
// OFFLINE FALLBACK for the site when the live federated fetch (GitHub) is
// unavailable at build/ISR time. Single source of truth is the federated registry
// (registry.json → each source repo); this is a derived artifact of the built-ins.
//
// Runs as `prebuild`; on Vercel (no sibling ../plugin) it no-ops and the committed
// snapshot is used. Locally `bun run snapshot` refreshes it.
import fs from "node:fs";
import path from "node:path";

const WEB = path.resolve(import.meta.dirname, "..");
const REPO = path.resolve(WEB, "..");
const COMPONENTS_DIR = path.join(REPO, "plugin", "components");
const REGISTRY = path.join(REPO, "registry.json");
const CONTRACT = path.join(REPO, "plugin", "spec", "CONTRACT.md");
const OUT = path.join(WEB, "lib", "registry.generated.json");

if (!fs.existsSync(COMPONENTS_DIR)) {
  console.log("[snapshot] ../plugin not present — keeping committed snapshot.");
  process.exit(0);
}

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
const readText = (f) => { try { return fs.readFileSync(f, "utf8"); } catch { return ""; } };
const readFrames = (f) => { try { const a = JSON.parse(fs.readFileSync(f, "utf8")); return Array.isArray(a) ? a : []; } catch { return []; } };
// Block Elements + Legacy-Computing (incl. octants U+1CD00–1CEBF) → mosaic widget.
const MOSAIC_RE = /[▀-▟]|[\u{1FB00}-\u{1FBFF}]|[\u{1CC00}-\u{1CEBF}]/u;
const asStr = (v, d = "") => (typeof v === "string" ? v : d);
const asArr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
const asObj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const author = (raw) => {
  if (typeof raw === "string") return raw;
  const o = asObj(raw);
  return asStr(o.github) || asStr(o.name) || asStr(o.email);
};

const reg = readJson(REGISTRY) ?? {};
const builtin = (reg.sources ?? []).find((s) => s.path === "plugin/components") ?? {
  repo: "zyx1121/claude-statusline", ref: "main", path: "plugin/components",
  author: "zyx1121", official: true,
};

function readComponent(dir) {
  const cd = path.join(COMPONENTS_DIR, dir);
  const m = readJson(path.join(cd, "component.json"));
  if (!m) return null;
  const requires = asObj(m.requires);
  const caps = asObj(m.capabilities);
  const configSchema = asObj(asObj(m.config).schema);
  const network = [...new Set([...asArr(requires.network), ...asArr(caps.network)])];
  const secretKey = /(secret|token|api[_-]?key|apikey|password)/i;
  const needsSecrets =
    asArr(requires.env).length > 0 || asArr(caps.env).length > 0 ||
    Object.entries(configSchema).some(([k, f]) => asObj(f).type === "secret" || secretKey.test(k));
  return {
    id: asStr(m.id, dir),
    name: asStr(m.name, asStr(m.id, dir)),
    version: asStr(m.version),
    author: author(m.author) || builtin.author,
    repo: builtin.repo, ref: builtin.ref ?? "main", path: builtin.path, official: !!builtin.official,
    description: asStr(m.description),
    type: m.type === "line" ? "line" : "segment",
    runtime: asStr(m.runtime),
    hasFetch: typeof m.fetch === "object" && m.fetch !== null,
    network, needsSecrets,
    requires: { bin: asArr(requires.bin), network: asArr(requires.network), macos: asArr(requires.macos), env: asArr(requires.env) },
    configSchema,
    placement: asObj(m.placement),
    readme: readText(path.join(cd, "README.md")),
    preview: readText(path.join(cd, "preview.txt")),
    frames: readFrames(path.join(cd, "frames.json")),
    mosaic: MOSAIC_RE.test(readText(path.join(cd, "preview.txt"))),
  };
}

const components = fs.readdirSync(COMPONENTS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => readComponent(e.name))
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

const out = {
  generatedFrom: "plugin/components",
  sources: reg.sources ?? [builtin],
  components,
  contractMd: readText(CONTRACT),
  // 256-entry octant table (index = 8-bit 2×4 pattern → glyph). The web inverts
  // it to decode mosaic frames into real coloured pixels.
  octants: readText(path.join(COMPONENTS_DIR, "creatures", "assets", "octant.txt")).replace(/\n$/, ""),
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
const withPreview = components.filter((c) => c.preview.trim()).length;
console.log(`[snapshot] wrote ${path.relative(WEB, OUT)} — ${components.length} components (${withPreview} with preview)`);
