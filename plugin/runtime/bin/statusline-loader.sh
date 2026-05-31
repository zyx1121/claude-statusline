#!/usr/bin/env bash
# Stable status-line entry — installed by /statusline:setup to
# ~/.claude/plugins/statusline-loader.sh, and pointed at by settings.json's
# statusLine.command. Resolves the LATEST installed claude-statusline plugin
# version and execs its loader, so plugin updates take effect without re-editing
# settings (the cache path is version-numbered and churns on update).
root=$(ls -d "$HOME"/.claude/plugins/cache/*/statusline/*/runtime \
            "$HOME"/.claude/plugins/cache/*/statusline/*/plugin/runtime \
            2>/dev/null | sort -V | tail -1)
[ -n "$root" ] || exit 0
STATUSLINE_PLUGIN_ROOT="$(cd "$root/.." && pwd)" exec bash "$root/loader.sh"
