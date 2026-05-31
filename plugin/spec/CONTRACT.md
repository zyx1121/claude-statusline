# Component IO Contract

本文件定義 statusline host（`runtime/loader.sh` + `runtime/lib/{core,contract}.sh`）與單一
component 之間的 IO 約定。寫 component 前先讀完這頁 — manifest schema 在
`component.schema.json` / `profile.schema.json`，這裡講的是 **runtime 行為**。

## 一句話模型

每個 tick，Claude Code 把一段 statusline JSON 從 stdin 餵給 host。host 用一次 `jq` 把它
**投影**成 `CC_*` 環境變數（這層投影就是安全邊界：component 只看得到投影過的欄位，碰不到
原始 JSON），依 active profile 的 `(slot, order)` 逐一執行 component，再把各 slot 的輸出
組成多行字串印回 stdout 給 Claude Code 顯示。

component 有兩種型別：

| | `segment` | `line` |
|---|---|---|
| 執行方式 | host **source** `render.sh`，**in-process** 呼叫 `render__<id>` | host **fork** 一個 `runtime` 子行程跑 entry |
| fork 成本 | 零 | 每次 render 一個行程（用 `render.ttl` 攤平） |
| 輸出 | 一段**內嵌字串**（透過 `REPLY`） | 一或多**整行**（stdout） |
| runtime | 必須是 `bash`（host 要 source 它） | 任意（`python3` / `node` / …） |
| slot | `row1` / `row2`（用 ` · ` 串接成一行） | `top` / `middle` / `bottom`（整行，可多行） |
| 可否 fetch | 否 | 可（背景刷新） |
| 隱藏 | 不設 / 設 `REPLY=""` | 印空輸出 |

版面組裝順序（固定）：`top` 行 → 可選 rule → `middle` 行 → `row1` → `row2` → `bottom` 行。

## stdin 投影 → CC_* 環境變數

host 把 stdin JSON 投影成下列環境變數，**所有** component 都拿得到完整這組。沒有對應資料
時為空字串。這是 component 唯一看得到的 input —— **不要自己 parse 原始 stdin JSON**，一律走
`CC_*`。新增欄位只會在這裡加，舊 component 不受影響。

| 環境變數 | 來源 stdin path | 內容 |
|---|---|---|
| `CC_MODEL` | `model.display_name` | 模型顯示名 |
| `CC_CTX_PCT` | `context_window.used_percentage` | context window 使用百分比（純數字，無 `%`） |
| `CC_FIVE_PCT` | `rate_limits.five_hour.used_percentage` | 5h rate-limit 視窗使用百分比 |
| `CC_FIVE_RESET` | `rate_limits.five_hour.resets_at` | 5h 視窗 reset 時間 |
| `CC_WEEK_PCT` | `rate_limits.seven_day.used_percentage` | 7d rate-limit 視窗使用百分比 |
| `CC_WEEK_RESET` | `rate_limits.seven_day.resets_at` | 7d 視窗 reset 時間 |
| `CC_COST` | `cost.total_cost_usd` | 本 session 累計花費（USD） |
| `CC_PR_NUM` | `pr.number` | 目前 branch 的 PR 編號 |
| `CC_PR_STATE` | `pr.review_state` | 該 PR 的 review 狀態 |
| `CC_SID` | `session_id`（缺則 `default`） | session id（cache key 用） |
| `CC_PROJECT_DIR` | `workspace.project_dir` ‖ `workspace.current_dir` ‖ `cwd` | 工作目錄 |

> manifest 的 `inputs` 與 `capabilities.stdin_fields` 用**原始 dotted stdin path**
> （如 `context_window.used_percentage`）宣告依賴，供審查/最小權限用；render 時實際讀的是
> 上表對應的 `CC_*` 環境變數。

## segment 約定

`render.sh` 定義一個函式 `render__<id>`，host source 後 in-process 呼叫：

```bash
#!/usr/bin/env bash
# <id> — segment; reads CC_*, returns via $REPLY.
render__<id>() {            # $1 = config JSON (此 instance 的 config，已補 default)
  [ -n "$CC_CTX_PCT" ] || return 0          # 沒料 → 不設 REPLY，視為隱藏
  local i col
  printf -v i '%.0f' "$CC_CTX_PCT"
  col=$(pct_color "$i")                       # core.sh helper：≥80% 轉紅
  printf -v REPLY "${KEY}ctx${RESET} ${col}%d%%${RESET}" "$i"
}
```

規則：

- **input**：`CC_*` 環境變數 + `$1` = 此 instance 的 config JSON 字串（profile 的 `config`
  以 compact JSON 傳入；空 config 為 `{}`）。用 `jq` 取值，例：`jq -r '.window // "5h"'`。
- **output**：把要顯示的內嵌字串 `printf -v REPLY ...` 寫進 `REPLY`（用真 ESC，不是字面
  `\033`）。不設 `REPLY` 或 `REPLY=""` = 隱藏（不佔位、不出現 ` · ` 分隔符）。
- **不要 `echo` / `printf` 到 stdout** — segment 是 in-process，任何 stdout 都會污染整行。
- 函式名必須是 `render__<id>`，`<id>` 等於 `component.json` 的 `id`。
- runtime 固定 `bash`。可用 `lib/core.sh` 提供的共用名（**保持穩定**）：
  `KEY` / `VAL` / `RESET` 等調色盤、`pct_color <pct>`（≥80% 紅）、`fmt_countdown <epoch>`
  （`1h20m` / `42m` / `now`）、`join_sep`。
- 退出以 `return 0` 為準。

同一 slot（`row1` / `row2`）內所有非空 segment 依 `order` 由小到大、以 ` · ` 串接成一行。

## line 約定

line component 是被 fork 的獨立程式。host 以固定 argv 呼叫 `render.entry`：

```
<runtime> <render.entry> <cols> --session <sid> [--<k> <v> ...]
```

- `<cols>`：終端寬度（整數），第一個位置參數，自行 wrap / truncate（注意 CJK 寬度）。
- `--session <sid>`：等於 `CC_SID`，拿來當每-session cache / scroll-offset 的 key。
- `--<k> <v>`：此 instance config 中的**純量** key 攤平成 flag；**陣列 / 物件不會傳**
  （讀不到，改用 `config.file` 打包的預設檔，見下）。
- 同樣讀得到 `CC_*` 環境變數。

輸出：把要顯示的內容印到 **stdout**，可多行（每行就是 statusline 的一行，如 creatures 場景）。
印空 = 隱藏。stderr 不顯示，可拿來 debug。退出碼非 0 視為失敗，該 line 略過。

### render.ttl

`render.ttl`（預設 `1`）控制 fork 頻率：

- `1`：每 tick 都 fork 一次 render（捲動最滑順）。
- `>1`：N 秒內重用上次 render 的 stdout、不再 fork。適合輸出變動慢但 render 不便宜的 widget。
  cache 由 host 管理（路徑 `${STATUSLINE_STATE}/.render.<sid>`）。

### fetch（選用，背景刷新）

需要打網路或跑慢任務的 line component，把「取數」跟「畫面」分開：

- render **永不碰網路**，只讀自己寫的 cache、立即回畫面。
- 取數走背景、detached、**永不阻塞 tick**：cache 超過 `fetch.ttl`（預設 300s）時刷新。
  目前 widget 自管刷新（`fetch.self_managed: true`）— render 偵測 cache 過期就自己
  `subprocess.Popen([..., "--fetch"], start_new_session=True)`。`fetch.entry` 常與
  `render.entry` 同檔，用 `fetch.args`（如 `["--fetch"]`）切模式。
- fetch 把結果**原子寫**（寫 `.tmp` 再 `os.replace`）進 cache 檔，render 只讀。網路目標
  須列在 `requires.network` / `capabilities.network`。

## State / config / 目錄

runtime（loader / lib / components）住在 git 同步的樹裡；**state / cache 一律在 repo 外**。
host fork line component 時注入兩個環境變數：

| 注入環境變數 | 指向 | 用途 |
|---|---|---|
| `STATUSLINE_STATE` | `~/.claude/.statusline-state/<id>/`（host `mkdir -p`） | 此 component 的 cache / per-session offset / fetch 輸出。**只寫這裡。** |
| `STATUSLINE_CONFIG` | component 自己的目錄（repo 內） | 讀打包的預設檔（`config.file`，如 `symbols.default` / `topics.default`） |

- cache 檔自取名，建議含 sid 避免 session 互踩（如 `.<id>.<sid>.state.json`）。fetch
  process 同樣讀 `STATUSLINE_STATE` 找路徑，不要自己另開目錄。
- segment 不吃這兩個環境變數（in-process）；需要慢源資料時讀 loader-scope 的共用 cache
  變數（如 pve 的 `$pve_run` / `$pve_total`，由 B-class refresher 注入）。

### component 解析順序（兩層 search path）

1. **user layer**：`~/.claude/statusline/components/<id>/`（個人 + `install` 進來的）— **優先**。
2. **plugin layer**：`${STATUSLINE_PLUGIN_ROOT}/components/<id>/`（shim 解析出的最新 plugin 版）。

user layer 同 id 會整個覆蓋 plugin 內建版，便於本機改寫不動 plugin。

## Config 與 schema

- `component.json` 的 `config.schema` 宣告每個 knob 的 `type`（或 `enum`）/ `default` / `desc`。
- profile 的 `components[].config` 提供覆寫值；缺的 key 由 schema default 補齊後才交給 component。
- segment 收到序列化後的完整 config JSON 作 `$1`；line 收到攤平後的純量 `--<k> <v>` flags
  （陣列 / 物件 config 走 `config.file` 打包的預設檔）。

## 速查清單（寫新 component）

1. 建 `~/.claude/statusline/components/<id>/`（或 plugin `components/<id>/`），目錄名 = `id`。
2. 寫 `component.json`，過 `component.schema.json`：`$schema` / `id` / `name` / `version` /
   `type` / `runtime` / `render` 必填；附 `README.md`（給 Claude 審查）。
3. segment → `render.sh` 定義 `render__<id>`，只設 `REPLY`，讀 `CC_*` + `$1`，不印 stdout。
   line → render 腳本讀 `<cols> --session <sid> [--k v]`、印 stdout；要網路時加 `fetch` +
   原子寫 cache 到 `STATUSLINE_STATE`，並在 `requires`/`capabilities` 宣告 network / fs_write。
4. 在 profile 的 `components[]` 引用（可指定 `slot` / `order` / `config`）。
5. 同 id 可多次出現，用 `order` + `config` 區分（如 ratelimit 的 5h / 7d）。
