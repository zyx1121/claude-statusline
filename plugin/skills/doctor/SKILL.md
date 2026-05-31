---
name: doctor
description: Health-check the statusline install end to end — verifies the stable shim is present and executable, that settings.json points at it, that the shim resolves an installed plugin version, that the loader runs cleanly on a mock stdin, that the active profile is valid JSON with every component resolving on the search path, that each render entry is runnable, and that fetch caches are fresh. Reports a pass/fail checklist with suggested fixes. Run when the status line is blank, stale, or misbehaving.
---

# statusline:doctor

Diagnose a broken or stale status line. Walk the checks below **in order** (each builds on the last), collect a `✓ / ✗ / ⚠` result for every line, then print the checklist and the suggested fix for any non-pass. Do not stop at the first failure — run all checks so the user gets the full picture, but note when an early failure makes later checks moot.

Paths (from the loader + `lib/contract.sh`):
- shim = `~/.claude/plugins/statusline-loader.sh`
- user layer = `~/.claude/statusline/` (its `components/` is searched first, then plugin built-ins)
- active profile = `$STATUSLINE_PROFILE` if set, else `~/.claude/statusline/profiles/default.json`, else the bundled `<plugin>/profiles/full.json` fallback
- per-component state/cache = `~/.claude/.statusline-state/<id>/` (loader exports this to each component as `STATUSLINE_STATE`; render output-cache lives at `~/.claude/.statusline-state/<id>/.render.<sid>`; a `line` component's `fetch` is `self_managed` and writes its own cache file inside that same dir)
- plugin installs = `~/.claude/plugins/cache/*/statusline/<version>/{runtime,plugin/runtime}/` (the shim globs both shapes, `sort -V | tail -1`)

## Procedure

1. **Shim present + executable.** Check `~/.claude/plugins/statusline-loader.sh` exists and has the executable bit (`test -x`). Pass = both. Fix: run `/statusline:setup` (it copies the shim out and `chmod +x`); or `chmod +x ~/.claude/plugins/statusline-loader.sh` if it merely lost the bit.

2. **settings.json wired.** Read `~/.claude/settings.json`, confirm `.statusLine.type == "command"` and `.statusLine.command` points at the shim (setup writes the literal `~/.claude/plugins/statusline-loader.sh`; a `$HOME`-expanded absolute form also passes). Pass = match. Fix: run `/statusline:setup` to wire it (it merges only the `statusLine` key and keeps a backup at `~/.claude/settings.json.statusline.bak`). If `statusLine` points somewhere else, warn that another status line is configured and show the current value before offering to overwrite.

3. **Shim resolves a plugin version.** Mirror the shim's own resolution: glob `~/.claude/plugins/cache/*/statusline/*/runtime` and `~/.claude/plugins/cache/*/statusline/*/plugin/runtime`, take `sort -V | tail -1`, and confirm `<that>/loader.sh` is a real file. Pass = a `loader.sh` resolved. Fix: `/plugin install statusline@claude-statusline` (the plugin isn't installed or the install is corrupt). Report which version dir resolved.

4. **Loader runs on a mock stdin.** Pipe a mock CC stdin JSON into the shim and capture stdout, stderr, and exit code:
   `printf '%s' '{"model":{"display_name":"claude-opus-4-8"},"workspace":{"current_dir":"'"$PWD"'"},"session_id":"doctor","cost":{"total_cost_usd":0}}' | ~/.claude/plugins/statusline-loader.sh`
   Pass = exit 0 and no stderr. Show the rendered output so the user sees what CC would. Fix: if it errors, surface the stderr verbatim — common causes are a missing `jq` (check `command -v jq`), a malformed profile (covered next), or an unresolved component.

5. **Active profile is valid JSON.** Determine the active profile by the loader's resolution order (`$STATUSLINE_PROFILE` → `~/.claude/statusline/profiles/default.json` → bundled `<plugin>/profiles/full.json`) — say which path is active. Parse it with `jq .`. Pass = parses. Fix: if a user `default.json` is malformed, show the `jq` parse error; suggest restoring from a bundled `profiles/*.json` or re-running `/statusline:setup`.

6. **Every component resolves on the search path.** For each entry in the active profile's `.components[]`, resolve its `id` user-layer-first: `~/.claude/statusline/components/<id>/` then `<plugin>/components/<id>/`. Pass = every id resolves and has a readable `component.json`. List each component with the layer it resolved from (user vs built-in). Fix: an unresolved id is a typo in the profile or a missing user component — show the offending id and the two paths searched.

7. **Each render entry is runnable.** For every resolved component, read `component.json` and check its `render.entry` exists in the component dir, and that its declared `runtime` is on PATH (`bash` always; `python3`/`node`/etc via `command -v`). Also check each binary in `requires.bin`. Pass = entry file present + runtime + required bins available. Fix: name the missing file or the missing binary and how to install it (e.g. `brew install <bin>`). A `requires.network`/`requires.macos` mismatch is a `⚠`, not a `✗`.

8. **Fetch caches fresh / stale.** For each `line` component that declares a `fetch` block, inspect its state dir `~/.claude/.statusline-state/<id>/` (the loader's `STATUSLINE_STATE` for that component; fetch is `self_managed`, so the component owns its cache file under a name it chooses — e.g. stock-ticker writes `.statusline-ticker.cache.json`). Find the freshest cache-looking file in that dir, ignoring the host's render-cache (`.render.*`) and any per-session `*.state.json`. Determine its age: prefer a `fetched_at` epoch inside the JSON if present, else fall back to file mtime; compare against `fetch.ttl` seconds: age < ttl = `✓ fresh`; age ≥ ttl = `⚠ stale (age vs ttl)`; dir/cache absent = `⚠ never fetched`. Stale/absent is informational (the loader kicks a background fetch on the next tick), so report it but never as `✗`. Segments, and line components without a `fetch` block, are N/A — skip them.

9. **Report.** Print a single checklist, one line per check (`✓ / ✗ / ⚠` + the check name + a one-line detail). Below it, list the suggested fix for each `✗` and notable `⚠`. End with a one-line verdict: all-green → "statusline healthy"; any `✗` → name the first blocking failure and its fix. If checks 1–4 fail, note that 5–8 may be unreliable until the host wiring is fixed.
