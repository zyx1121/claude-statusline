import { REPO, type Profile } from "./registry";

/**
 * Generators for the two install paths a template offers:
 *  - bootstrapScript: a self-contained `curl … | bash` installer (no Claude Code
 *    needed) — clones the plugin, wires its loader into settings.json, writes the
 *    profile, and activates it.
 *  - claudePrompt: a copy-paste prompt that has Claude Code install the plugin and
 *    set the profile up autonomously via the marketplace + /statusline:* skills.
 * Both are derived from the profile JSON, so the marketplace stays the source of truth.
 */

const dedent = (s: string) => s.replace(/^\n/, "").replace(/\n[ \t]+$/, "\n");

export function bootstrapScript(profile: Profile): string {
  const name = profile.name;
  const json = JSON.stringify(profile, null, 2);
  return dedent(`
#!/usr/bin/env bash
# claude-statusline — installer for the "${name}" profile.
# Source: https://github.com/${REPO}
set -euo pipefail

REPO_URL="https://github.com/${REPO}.git"
SRC="\${HOME}/.claude/statusline-src"
USER_LAYER="\${HOME}/.claude/statusline"
SETTINGS="\${HOME}/.claude/settings.json"
PROFILE="${name}"

say() { printf '\\033[36m▸\\033[0m %s\\n' "$1"; }
die() { printf '\\033[31m✗ %s\\033[0m\\n' "$1" >&2; exit 1; }

for bin in git jq python3; do
  command -v "$bin" >/dev/null 2>&1 || die "missing required command: $bin"
done

say "Fetching the statusline plugin…"
if [ -d "\${SRC}/.git" ]; then
  git -C "\${SRC}" pull --ff-only --quiet
else
  git clone --depth 1 "\${REPO_URL}" "\${SRC}" --quiet
fi

LOADER="\${SRC}/plugin/runtime/loader.sh"
[ -f "\${LOADER}" ] || die "loader not found at \${LOADER}"
chmod +x "\${LOADER}" 2>/dev/null || true

say "Wiring the loader into settings.json (only the statusLine key)…"
mkdir -p "\${HOME}/.claude"
[ -f "\${SETTINGS}" ] || echo '{}' > "\${SETTINGS}"
cp "\${SETTINGS}" "\${SETTINGS}.statusline.bak"
tmp="$(mktemp)"
jq --arg cmd "\${LOADER}" '.statusLine = {type:"command", command:$cmd, refreshInterval:1}' \\
  "\${SETTINGS}" > "\${tmp}" && mv "\${tmp}" "\${SETTINGS}"

say "Writing and activating the '${name}' profile…"
mkdir -p "\${USER_LAYER}/profiles" "\${USER_LAYER}/components"
cat > "\${USER_LAYER}/profiles/${name}.json" <<'STATUSLINE_PROFILE_JSON'
${json}
STATUSLINE_PROFILE_JSON

# The loader renders profiles/default.json — back up any existing one, then activate.
if [ -f "\${USER_LAYER}/profiles/default.json" ]; then
  cp "\${USER_LAYER}/profiles/default.json" "\${USER_LAYER}/profiles/default.json.bak"
fi
cp "\${USER_LAYER}/profiles/${name}.json" "\${USER_LAYER}/profiles/default.json"

printf '\\033[32m✓ statusline installed — profile "%s" is active.\\033[0m\\n' "${name}"
echo "  Open a new Claude Code prompt (or restart the session) to see it."
echo "  Undo: mv \\"\${SETTINGS}.statusline.bak\\" \\"\${SETTINGS}\\""
`);
}

export function claudePrompt(profile: Profile): string {
  const name = profile.name;
  const json = JSON.stringify(profile, null, 2);
  return dedent(`
Set up the "${name}" status-line profile from the claude-statusline marketplace for me.

1. Add the marketplace:  /plugin marketplace add ${REPO}
2. Install the plugin:   /plugin install statusline@claude-statusline
3. Wire it up:           /statusline:setup
4. Write this profile to ~/.claude/statusline/profiles/${name}.json and make it the
   active default by copying it to ~/.claude/statusline/profiles/default.json:

${json}

Every component this profile references ships with the plugin, so no extra installs
are needed. When you're done, preview the status line and confirm it renders.
`);
}
