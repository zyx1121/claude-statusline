---
name: preview
description: Render a single statusline component or a whole profile to the terminal as a dry-run — feed mock (or real) stdin, run via the loader / the component's render entry with STATUSLINE_PLUGIN_ROOT set, show the ANSI output, refresh a few ticks for scrollers, then confirm nothing was committed. Use when the user runs /statusline:preview, asks to "preview", "試跑", "預覽" a component or profile, or wants to see what a component/profile looks like before enabling it.
---

# /statusline:preview [component|profile]

預覽 — 把一個 component 或整個 profile 渲染到 terminal 看效果，**不** enable、不寫 `settings.json`、不動 user layer。`$ARGUMENTS` 是要預覽的 id：可以是某個 component id，或某個 profile name。沒給就問使用者要預覽哪一個（並列出可選項，見 Step 1）。

A preview NEVER writes `settings.json`, the user-default profile, or any cache the runtime reads at tick time. 唯一允許寫的是 `$TMPDIR` 底下的臨時 mock JSON。

## Procedure

### 1. Resolve plugin root + 判斷 target 是 component 還是 profile

- `STATUSLINE_PLUGIN_ROOT` = 這個 plugin 的根（含 `runtime/`、`components/`、`profiles/`）。在 skill 執行情境下用 `${CLAUDE_PLUGIN_ROOT}`；後續所有指令都 `export STATUSLINE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"`，loader 跟 line widget 都靠它定位。
- 沒帶 `$ARGUMENTS`：列出可選項再問。
  - profiles：`ls "$STATUSLINE_PLUGIN_ROOT"/profiles/*.json` 跟 `~/.claude/statusline/profiles/*.json`（檔名去 `.json` 即 name）。
  - components：user layer `~/.claude/statusline/components/*/component.json` 優先，再 built-ins `"$STATUSLINE_PLUGIN_ROOT"/components/*/component.json`（同 id 以 user layer 為準）。
- 判斷 `$ARGUMENTS` 屬於哪類：先比對 profile（任一 layer 有 `profiles/<arg>.json` → profile）；否則比對 component id（任一 layer 有 `components/<arg>/component.json` → component）。兩邊都不中就回報「找不到 <arg>」並列出可選項，停。

### 2. 準備 representative mock stdin（或拿真的）

CC 餵給 statusline 的是一段 stdin JSON；loader 的 `extract_stdin_fields` 用一次 jq 把它投影成 component 唯一看得到的那組 `CC_*`。準備一份代表性 mock：

- 若當下有真的 stdin sample（使用者貼的、或 repo fixture），優先用真的。
- 否則寫一份 mock 到 `MOCK="$(mktemp -t sl-preview).json"`，欄位要能驅動目標 component 的所有顯示分支。鍵名以 `runtime/lib/contract.sh` 的 `extract_stdin_fields` 為準，骨架：

```json
{
  "model": { "display_name": "Opus 4.8" },
  "context_window": { "used_percentage": 42 },
  "rate_limits": {
    "five_hour": { "used_percentage": 18, "resets_at": "2026-05-31T18:00:00Z" },
    "seven_day": { "used_percentage": 63, "resets_at": "2026-06-03T00:00:00Z" }
  },
  "cost": { "total_cost_usd": 1.23 },
  "pr": { "number": 161, "review_state": "open" },
  "session_id": "preview-session",
  "workspace": { "project_dir": "<cwd>" }
}
```

> 投影後 component 只會看到這幾個變數：`CC_MODEL` `CC_CTX_PCT` `CC_FIVE_PCT` `CC_FIVE_RESET` `CC_WEEK_PCT`（來自 `rate_limits.seven_day`）`CC_WEEK_RESET` `CC_COST` `CC_PR_NUM` `CC_PR_STATE`（來自 `pr.review_state`）`CC_SID` `CC_PROJECT_DIR`（`workspace.project_dir` → `workspace.current_dir` → `cwd` fallback）。要驗證投影正確：`./runtime/lib`-source 後 `extract_stdin_fields < "$MOCK"`，看吐出的 `export CC_*` 對不對。鍵名若跟 contract.sh 對不上就照 contract.sh 改 mock，別憑空塞。

### 3a. Profile preview — 走完整 loader

整個 profile 就照 runtime 真正的方式跑一遍，最忠實：

```bash
export STATUSLINE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
# STATUSLINE_PROFILE 吃的是 profile JSON 的「路徑」，不是 bare name。
STATUSLINE_PROFILE="$STATUSLINE_PLUGIN_ROOT/profiles/<name>.json" \
  bash "$STATUSLINE_PLUGIN_ROOT"/runtime/loader.sh < "$MOCK"
```

- loader 解析 profile 的順序是 `STATUSLINE_PROFILE`（路徑）→ user default `~/.claude/statusline/profiles/default.json` → bundled `profiles/full.json`。預覽時**只用 `STATUSLINE_PROFILE` 指向要看的那份 JSON，絕不去改 user default**。要看 user 自訂 profile 就把路徑指到 `~/.claude/statusline/profiles/<name>.json`。
- loader 輸出就是真實 multi-line block：top widget 行 → （profile `rule:true` 才有）host 畫的 rule → middle widget 行 → row1 segments（` · ` 串）→ row2 segments → bottom widget 行。原樣印出，ANSI 直接顯示。

### 3b. Component preview — 單獨跑那一個 component

先 `cat "$dir/component.json"`（`dir` 為命中的 layer）拿 `type` `runtime` `render.entry` `render.ttl` `fetch`，依 `type` 分流。

**segment**（`render.sh` 定義 `render__<id>()`，靠 `CC_*` env、config 走 `$1`，結果回 `$REPLY`）。注意 `render_segment` 內部用 `${COMPONENTS}` 找 render.sh，且 segment 常用 core.sh 的 `pct_color` / `fmt_countdown` / `SEP` 等 helper — 獨立預覽要把這兩個都備齊：

```bash
export STATUSLINE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
( source "$STATUSLINE_PLUGIN_ROOT"/runtime/lib/core.sh          # palette + helper
  source "$STATUSLINE_PLUGIN_ROOT"/runtime/lib/contract.sh
  eval "$(extract_stdin_fields < "$MOCK")"                      # 投影出真實 CC_*
  COMPONENTS="$dir_parent"                                      # 命中 layer 的 components/ 母目錄
  printf '%b\n' "$(render_segment '<id>' '<config-json-or-{}>')" )
```

`render_segment` 回傳即該 segment 字串（內含 `\033[` 字面 ESC，故用 `%b` 印）；空字串代表這個 tick 它選擇隱藏（要講出來）。`<config-json>` 例如 ratelimit 的 `'{"window":"7d"}'`。

**line**（standalone，host FORK：`<runtime> <entry> <cols> --session <sid> [--k v]`，config 只有 scalar 會變 flag，array/object 走 component 自己的 config file）：

```bash
export STATUSLINE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
STATUSLINE_STATE="$(mktemp -d -t sl-preview-state)" \
STATUSLINE_CONFIG="$dir" \
  <runtime> "$dir/<render.entry>" "$(tput cols 2>/dev/null || echo 80)" \
    --session preview-session [--<k> <v> …]
```

- `STATUSLINE_STATE` 指到臨時 dir，避免污染 component 真正的 state（`~/.claude/.statusline-state/<id>`）；`STATUSLINE_CONFIG=$dir` 讓它讀得到自己的 config file（如 stock-ticker 的 `symbols.default`）。
- 有 `fetch`：line widget 讀的是自己 fetch 寫的 cache。預覽時可先手動跑一次 fetch（`<runtime> <fetch.entry> <fetch.args…>`，例如 stock-ticker 是 `render.py --fetch`，配同樣的 `STATUSLINE_STATE` / `STATUSLINE_CONFIG`）把 cache 寫進臨時 state，再跑 render；或接受第一次 render 是 cold（空 / placeholder）並講明。fetch 寫的是它自己的 cache，**不是 runtime 啟用狀態**，屬預覽允許副作用，但要告知使用者跑了 fetch。
- `render.ttl > 1`：host 平常會 reuse cached output；獨立預覽是直跑 entry，本來就每次重算，看到的就是即時輸出，不用碰 manifest。

### 4. Scroller / 動態 component — 多刷幾個 tick

跑馬燈、時鐘、隨 tick 變化的 widget 單張看不出效果。連刷幾次、每次間隔約 1s：

```bash
for i in 1 2 3 4 5; do
  STATUSLINE_PROFILE="$STATUSLINE_PLUGIN_ROOT/profiles/<name>.json" \
    bash "$STATUSLINE_PLUGIN_ROOT"/runtime/loader.sh < "$MOCK"   # 或 Step 3b 的單 component 指令
  sleep 1
done
```

- component preview 同理重跑同一條指令。news / stock-ticker 這類的 scroll 位置吃 epoch 秒，每次 fork 自然前進；間隔 1s 才看得到推進。
- 印 5 frame 左右即可，足以展示循環 / 捲動。

### 5. 收尾 — 明確聲明「沒有 commit 任何東西」

- 清掉臨時檔：`rm -f "$MOCK"`，以及 Step 3b 建的臨時 `STATUSLINE_STATE` dir。
- 給使用者一段清楚結語，必須包含：
  - 這只是 dry-run preview，**沒有**寫 `settings.json`、**沒有**改 user-default profile、**沒有**動 user layer / 真正的 component state。
  - 若 line widget 有 `fetch` 且你跑了它，誠實說明它寫了 cache（這裡導到臨時 state，正常運作的一部分，跟「啟用 component」無關）。
  - 真要套用，請走 `/statusline:setup`（首次安裝 / 接線）或對應的 configure / profile 切換指令 — preview 不會替你做。

## Notes

- 找不到 `${CLAUDE_PLUGIN_ROOT}` / `STATUSLINE_PLUGIN_ROOT`：回報無法定位 plugin root，請使用者確認已 `/plugin install statusline@claude-statusline`，停。
- component `requires`（`bin` / `network` / `macos`）沒滿足時 render 可能空或報錯 — 照實呈現並指出缺的依賴，不要假裝有輸出。
- 本檔指令是骨架。env 變數名、stdin 鍵、調用方式一律以 `runtime/loader.sh`、`runtime/lib/contract.sh`、`runtime/lib/core.sh` 為準，別照本檔字面硬套。
