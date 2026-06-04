# claude-statusline

> A Claude-native, modular status line for Claude Code — compose it from small, self-contained components, and let Claude read, vet, and tune them for you.

`multi-line` · `composable components` · `profile-driven` · `installed from inside Claude` · `federated marketplace`

[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-d97757)](https://github.com/zyx1121/claude-statusline) &nbsp;[![Live playground](https://img.shields.io/badge/playground-statusline.zyx.tw-111111)](https://statusline.zyx.tw) &nbsp;[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](#license)

```text
📰  Breaking ……… latest headlines scrolling across the top …………………………
────────────────────────────────────────────────────────────────────
        ▟▙              ▗▄▖
       ▟██▙            ▟███▙        ← a little creature pacing the strip
      ▝▀██▀▘           ▝███▘
▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█  (time-of-day grass)
 opus-4.8  ·  ctx 38%  ·  5h 22% ↻1h47m  ·  7d 61% ↻3d  ·  $0.42
 ⎇ main ✓  ·  PR #128 ✓  ·  $0.18/hr  ·  ♪ Nujabes — Aruarian Dance
 0050 ▲131.05   2353 ▼ 78.40   2382 ▲142.00   3231 ▲ 24.95   TAIEX ▲
```

<sub>That's the **`full`** profile — a news ticker on `top`, a creatures stage in the `middle`, a session row and a repo/usage row, and a stock ticker on the `bottom`. Every line is an independent **component**; swap the profile and the line re-composes itself.</sub>

## Install

```
/plugin marketplace add zyx1121/claude-statusline
/plugin install statusline@claude-statusline
/statusline:setup
```

`/statusline:setup` installs a stable shim, points `settings.json`'s `statusLine.command` at it, creates your user layer, and previews the result. (Claude Code can't expand a plugin path inside `statusLine.command`, and the plugin cache path is version-numbered and churns on every update — so the shim resolves the latest installed version at runtime, and you only wire it once.)

> Browse, preview, and copy an install command for every component at **[statusline.zyx.tw](https://statusline.zyx.tw)**.

## Concepts

- **Component** — one widget or segment: a directory under `components/<id>/` with a `component.json` manifest and a renderer (`render.sh` or `render.py`). It reads a fixed set of `CC_*` inputs and emits its own piece of the line.
- **Profile** — a template that composes components: which run, which slot each sits in, their order, and per-instance config. The same component can appear more than once (e.g. a 5h and a 7d `ratelimit`, distinguished by order + config). `full` and `minimal` ship as examples.
- **Marketplace** — components are distributed like plugins. Install the built-ins, or drop a component into your **user layer** (`~/.claude/statusline/components/<id>`), which is searched first and overrides a built-in of the same id.

### Slots

The line is built top to bottom from named slots:

| Slot | Type | Behaviour |
|------|------|-----------|
| `top` / `middle` / `bottom` | line widgets | each may emit one or more full lines |
| `row1` / `row2` | segments | joined together with `  ·  ` |

## Built-in components

| id | type | what it shows |
|----|------|---------------|
| `model` | segment | model display name (short) |
| `ctx` | segment | context-window usage %, red at ≥80% |
| `ratelimit` | segment | 5h / 7d usage-limit % + reset countdown (multi-instance) |
| `cost` | segment | session cost in USD |
| `burn` | segment | cost burn rate ($/hr over the session) |
| `git` | segment | branch + dirty / ahead / behind state |
| `pr` | segment | open PR number + CI / review state |
| `nowplaying` | segment | now-playing track (macOS) |
| `divider` | line | a full-width horizontal rule — drop in any line slot |
| `news` | line | scrolling headlines ticker |
| `creatures` | line | a tiny ASCII creature world that paces the line |
| `stock-ticker` | line | left-scrolling TWSE stock ticker (keyless) |

## The Claude-native angle

A component is self-describing — its `component.json` declares what inputs it reads, what it requires (`bin` / `network` / `macos`), its capabilities, and its config schema. That's the contract Claude reads to **vet, install, and tune** a component on your behalf:

- **`/statusline:install <component>`** — Claude reads the source, summarises what it shows / which hosts it contacts / what it needs / its render cost, confirms with you, then installs it into your user layer and wires it into your profile. `<component>` can be a built-in id, a **registry id** (a third-party component listed in the marketplace), an `owner/repo`, a git URL, or a local path.
- **`/statusline:configure <component>`** — tune its config knobs (written to the user layer, never the component dir).
- **`/statusline:preview` / `/statusline:doctor`** — dry-run a component or profile, or health-check the whole install.

The status line is built to be operated by the assistant standing right next to it.

## Writing a component

A component is a directory with a `component.json` manifest and a renderer — no host changes needed to drop one in. Two kinds:

- **segment** — the host *sources* your `render.sh` and calls `render__<id>()` in-process (zero fork). It reads `CC_*` env plus its config JSON and returns its string in `REPLY` (empty = hidden). Ideal for cheap, always-on bits in `row1` / `row2`.
- **line** — a standalone executable, forked as `<runtime> render.py <cols> --session <sid> [--key val …]`, that prints one or more whole lines to `top` / `middle` / `bottom`. It may declare a background `fetch` — run on its own TTL — so network work never blocks rendering.

Full render/fetch contract: [`plugin/spec/CONTRACT.md`](plugin/spec/CONTRACT.md), with JSON schemas in [`plugin/spec/`](plugin/spec). Start from [`components/ctx`](plugin/components/ctx) for a segment or [`components/stock-ticker`](plugin/components/stock-ticker) for a line widget with a fetch step.

<details>
<summary><b><code>component.json</code> at a glance</b></summary>

```jsonc
{
  "$schema": "statusline/component@1",
  "id": "ctx",
  "name": "Context Usage",
  "version": "0.1.0",
  "author": { "github": "you" },
  "description": "Context-window usage percentage, turning red at ≥80%.",
  "type": "segment",                       // "segment" | "line"
  "runtime": "bash",                       // "bash" | "python3" | ...
  "render": { "entry": "render.sh" },      // optional "ttl"; a profile can override it per-instance
  "inputs": ["context_window.used_percentage"],  // stdin fields the host projects
  "requires": {},                          // { bin, network, macos }
  "config": {},                            // { schema, file } for tunable knobs
  "placement": { "slot": "row1", "order": 20 },
  "capabilities": { "stdin_fields": ["context_window.used_percentage"] }
}
```

Components only ever see the projected `CC_*` inputs (`CC_MODEL`, `CC_CTX_PCT`, `CC_FIVE_PCT`, `CC_FIVE_RESET`, `CC_WEEK_PCT`, `CC_WEEK_RESET`, `CC_COST`, `CC_PR_NUM`, `CC_PR_STATE`, `CC_SID`, `CC_PROJECT_DIR`) — never raw stdin. That projection is the security boundary.

</details>

## Contributing

New components are welcome — the marketplace is **federated**, so the usual path keeps your
component in **your own repo** and just indexes it here:

1. Put your component under `components/<id>/` in a repo of your own — `component.json`
   (validating against [`plugin/spec/component.schema.json`](plugin/spec/component.schema.json),
   `"statusline/component@1"`), a renderer (`render.sh` for a segment, `render.py` / an executable
   for a line), a `README.md`, and a `preview.txt`.
2. Add your repo as a source in [`registry.json`](registry.json) and open a PR.

CI validates every component against the spec; once it's merged the site lists it automatically and
users install it with `/statusline:install <id>`. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the
full walkthrough and [`plugin/spec/CONTRACT.md`](plugin/spec/CONTRACT.md) for the render/fetch contract.

To contribute into the **official built-in set** instead, open a PR adding the component directly
under [`plugin/components/<id>/`](plugin/components) in this repo — same manifest and spec, it just
ships with the plugin.

## License

MIT
