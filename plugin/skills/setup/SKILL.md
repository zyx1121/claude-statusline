---
name: setup
description: Install and wire up the statusline plugin — copy the stable shim to ~/.claude/plugins/, point settings.json statusLine at it, create the user layer, drop in a starter profile, and preview. Use when the user runs /statusline:setup or asks to install / enable / wire up / activate the status line.
---

# /statusline:setup

把 statusline plugin 接上 Claude Code 的 status line。整套流程冪等（idempotent）：重複跑安全，只會覆寫 plugin 自己管的檔、不動使用者的 profile / components。照下面步驟做，每一步做完用一句話跟使用者確認。

## 為什麼需要這個步驟（背景，幫助你判斷，不必照唸給使用者）

- `plugin.json` 無法設定 `statusLine`，CC 不支援。
- `settings.json` 的 `statusLine.command` **不會** 展開 `${CLAUDE_PLUGIN_ROOT}`，所以不能直接指向 plugin 內路徑。
- plugin cache 路徑帶版本號，每次更新都會 churn，寫死會在下次更新後失效。

因此：安裝一個 **stable shim** 到 `~/.claude/plugins/statusline-loader.sh`（這條路徑永遠不變），由 shim 在執行時解析「目前安裝的最新版」再 exec 它的 loader；`settings.json` 只指向這個 shim。

## 變數

先把這些路徑記在心裡（`$HOME` 即使用者家目錄，下面一律用絕對路徑）：

- `PLUGIN_ROOT` = `${CLAUDE_PLUGIN_ROOT}`（這個 skill 執行時可用）
- `SHIM_SRC` = `${CLAUDE_PLUGIN_ROOT}/runtime/bin/statusline-loader.sh`
- `SHIM_DST` = `$HOME/.claude/plugins/statusline-loader.sh`
- `SETTINGS` = `$HOME/.claude/settings.json`
- `USER_LAYER` = `$HOME/.claude/statusline`（`profiles/` + `components/`）
- `DEFAULT_PROFILE` = `$HOME/.claude/statusline/profiles/default.json`

## 步驟

### 1. 安裝 shim

```sh
mkdir -p "$HOME/.claude/plugins"
cp "${CLAUDE_PLUGIN_ROOT}/runtime/bin/statusline-loader.sh" "$HOME/.claude/plugins/statusline-loader.sh"
chmod +x "$HOME/.claude/plugins/statusline-loader.sh"
```

每次跑都重新 copy（讓 shim 本身能隨 plugin 更新），這步天然冪等。

### 2. 接上 settings.json（merge，不要 clobber）

先備份，再用 jq 合併 `statusLine` 這個 key，保留其它所有 key。

```sh
SETTINGS="$HOME/.claude/settings.json"
[ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"
cp "$SETTINGS" "$SETTINGS.statusline.bak"
tmp="$(mktemp)"
jq '.statusLine = {type:"command", command:"~/.claude/plugins/statusline-loader.sh", refreshInterval:1}' \
  "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"
```

注意：
- 一定要 merge —— 用 `jq '.statusLine = {...}'` 只改這一個 key，**絕不**整檔覆寫，否則會洗掉使用者的 permissions / hooks / env。
- 若無 `jq`，退而求其次用 Read 把 `settings.json` 讀進來、在記憶體裡改 `statusLine` 一個 key、再 Write 回去；同樣只動這個 key。
- `command` 字面寫 `~/.claude/plugins/statusline-loader.sh`（CC 會展開 `~`），不要寫成已展開的絕對路徑——讓 settings.json 在不同機器/家目錄間可攜。
- 備份固定叫 `settings.json.statusline.bak`，覆寫同名舊備份即可（冪等）。

### 3. 建立 user layer + starter profile

```sh
mkdir -p "$HOME/.claude/statusline/profiles" "$HOME/.claude/statusline/components"
```

只有在 `default.json` **不存在** 時才放 starter，避免覆蓋使用者已經調過的 profile：

```sh
DEFAULT="$HOME/.claude/statusline/profiles/default.json"
if [ ! -f "$DEFAULT" ]; then
  cp "${CLAUDE_PLUGIN_ROOT}/profiles/full.json" "$DEFAULT"
fi
```

starter 預設用 `profiles/full.json`（功能完整）；若使用者想要精簡版，改 copy `profiles/minimal.json`。`components/` 留空即可——使用者之後要 override 內建 component 或加自訂 component 才往裡面放（user layer 在 search path 上優先於 plugin 內建）。

### 4. 預覽

用一段 mock stdin 跑一次 loader，確認輸出正常（loader 從 stdin 吃 CC 的 JSON）：

```sh
echo '{"model":{"display_name":"Opus 4.8"},"session_id":"setup-preview","workspace":{"current_dir":"'"$HOME"'"},"cost":{"total_cost_usd":0}}' \
  | "$HOME/.claude/plugins/statusline-loader.sh"
```

把輸出原樣秀給使用者看。若報錯（缺 `jq` / profile JSON 壞掉 / 缺 component），指出哪一步、怎麼修，不要默默吞掉。

### 5. 回報使用者

跟使用者講清楚三件事：

1. **已生效** —— status line 已接上，下一個 prompt（或重啟 session）就會出現；目前用的 profile 是 `default`（內容來自 `~/.claude/statusline/profiles/default.json`）。
2. **怎麼切換 profile** —— 編輯 / 替換 `~/.claude/statusline/profiles/default.json`；plugin 內附 `full` 與 `minimal` 兩個範本可直接 copy 過去當底改。slot 規則：`top|middle|bottom` 是整行 widget、`row1|row2` 是用 ` · ` 串起來的 segment。
3. **怎麼還原（undo）** —— 把備份還原即可：
   ```sh
   mv "$HOME/.claude/settings.json.statusline.bak" "$HOME/.claude/settings.json"
   ```
   要徹底移除再加上 `rm -f "$HOME/.claude/plugins/statusline-loader.sh"`；`~/.claude/statusline/`（使用者的 profile / components）可自行決定保留或刪除。

## 冪等性總結

- shim：每次重 copy —— 安全。
- settings.json：只 merge `statusLine` 一個 key，舊備份原地覆寫 —— 安全。
- user layer：`mkdir -p` + 只在 `default.json` 不存在時才放 starter —— 不會蓋掉使用者調過的 profile。
