#!/usr/bin/env bash
# Stable status-line entry — installed by /statusline:setup to
# ~/.claude/plugins/statusline-loader.sh, and pointed at by settings.json's
# statusLine.command. Resolves the LATEST installed claude-statusline plugin
# version and execs its loader, so plugin updates take effect without re-editing
# settings (the cache path is version-numbered and churns on update).
# git-subdir flattens the plugin/ subdir to the version root, so the loader lives at
# cache/<mp>/statusline/<version>/runtime/. Use a nullglob-safe find, not a literal
# glob (an unmatched glob aborts the line under zsh's default nomatch).
root=$(find "$HOME/.claude/plugins/cache" -type d -path '*/statusline/*/runtime' 2>/dev/null \
       | sort -V | tail -1)
[ -n "$root" ] || exit 0
STATUSLINE_PLUGIN_ROOT="$(cd "$root/.." && pwd)" exec bash "$root/loader.sh"
