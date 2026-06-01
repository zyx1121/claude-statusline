#!/usr/bin/env bash
# Stable status-line entry — installed by /statusline:setup to
# ~/.claude/plugins/statusline-loader.sh, and pointed at by settings.json's
# statusLine.command. Resolves the LATEST installed claude-statusline plugin
# version and execs its loader, so plugin updates take effect without re-editing
# settings (the cache path is version-numbered and churns on update).
# git-subdir flattens the plugin/ subdir to the version root, so the loader lives at
# cache/<mp>/statusline/<version>/runtime/ — exactly depth 4 under the cache root.
# -maxdepth 4 is essential: this runs every status-line tick, and without it find
# descends the whole cache (tens of thousands of files: sprite assets, node_modules)
# adding ~0.5s+ per render. Use a find, not a literal glob (unmatched globs abort the
# line under zsh's default nomatch).
root=$(find "$HOME/.claude/plugins/cache" -maxdepth 4 -type d -path '*/statusline/*/runtime' 2>/dev/null \
       | sort -V | tail -1)
[ -n "$root" ] || exit 0
STATUSLINE_PLUGIN_ROOT="$(cd "$root/.." && pwd)" exec bash "$root/loader.sh"
