---
name: install
description: Install a status-line component into the user layer after vetting it. Use when the user runs /statusline:install <component>, asks to "add a component", "install a widget/segment", or names a component source (a registry id, git repo, URL, or local path). Reads the component's manifest + source, summarises what it shows / hosts it contacts / secrets it needs / its render cost, asks to confirm, then copies it into ~/.claude/statusline/components/ and adds it to the active profile.
---

# /statusline:install <component>

安裝一個 component 到 user layer，並掛進當前 profile。`<component>` 可以是 built-in id（如 `ctx`、`stock-ticker`）、**registry 上第三方元件的 id**、或顯式第三方來源（git repo `owner/name`、git URL、或本機路徑）。

**這個 command 的重點是 Claude-native vetting**：在任何東西落地之前，你（Claude）要親自讀過 component 的 source，把它「會顯示什麼、會連哪些 host、需不需要 secret、render 成本多高」講清楚給 user，等 user 確認後才安裝。不要跳過摘要直接 copy。

## 0. 解析 argument

`<component>` 沒給就問 user 要裝哪個（可提示：built-in id、`owner/repo`、git URL、或本機路徑）。

判斷來源類型：
- 純 id（`^[a-z0-9-]+$`，無 `/`、無 `.`）→ 先當 **built-in / 已存在的 user component / registry 上的第三方** 處理（Step 1 依序解析）。
- 含 `/` 但不是絕對路徑、不是 URL（如 `owner/repo` 或 `owner/repo#subdir`）→ GitHub repo。
- `http(s)://` 或 `git@` → git URL。
- 以 `/`、`./`、`~/` 開頭且本機存在 → 本機路徑。

## 1. 定位 component

依 search path 與來源類型找出 component 目錄（含 `component.json`）：

1. **User layer**：`~/.claude/statusline/components/<id>/` — 已裝過，直接跳 Step 5（只需確認有沒有掛進 profile）。
2. **Built-in**：`${CLAUDE_PLUGIN_ROOT}/components/<id>/`（plugin 內建）。命中的話走 **built-in 路徑**：built-in 不需要 copy 進 user layer，host 的 search path 本來就會 fall through 到 plugin 內建。直接跳 Step 5 把它 enable 到 profile，並告知 user「這是內建 component，已直接啟用，未複製到 user layer」。
3. **Registry 反查（純 id 專用）**：純 id 在 user layer、built-in 都沒命中時，它可能是別人經 federated registry 上架的第三方 component——用 id 反查它住在哪個 repo：
   - 抓 registry：`https://raw.githubusercontent.com/zyx1121/claude-statusline/main/registry.json`。
   - 遍歷 `sources[]`，對每個 source 試抓 `https://raw.githubusercontent.com/<repo>/<ref 缺省 main>/<path>/<id>/component.json`（HTTP 200 = 命中）。標 `official: true` 的 source 就是內建來源，純 id 已在 Step 2 處理過，略過。
   - 命中 → 取該 source 的 `repo` / `ref`（缺省 `main`）/ `path`，組成第三方來源 `<repo>` + 子目錄 `<path>/<id>`，接 **第 4 點當 GitHub repo 處理**（clone → vetting → copy 進 user layer）。
   - 多個 source 都有同 id → 照 `sources[]` 順序取第一個（與網站 first-writer-wins 一致），並明確告訴 user 有同名衝突、實際取了哪個 repo。
   - 全部 source 都沒命中 → 純 id 確實不存在，停下告訴 user 找不到，並提示可改用顯式 `owner/repo` / git URL / 本機路徑指定來源。
4. **顯式第三方來源**：argument 本身是 `owner/repo[#subdir]` / git URL / 本機路徑（或第 3 點反查命中後得到的來源），把它取到一個暫存目錄供檢視——
   - GitHub `owner/repo[#subdir]` / git URL：`git clone --depth 1` 到暫存目錄（如 `$(mktemp -d)`），`#subdir` 或 repo 內的子目錄就指到含 `component.json` 的那層。
   - 本機路徑：直接用該路徑當來源，不複製。
   找不到含 `component.json` 的目錄就停下回報 user，不要自己猜結構。

## 2. 讀 source（vetting 的原料）

從 component 目錄讀以下檔案，**全部讀過再下判斷**，不要只看 manifest 就放行：

- `component.json` — id / name / version / type / runtime / `render` / `fetch` / `inputs` / `requires` / `config.schema` / `placement` / `capabilities`。
- `README.md` — 作者宣稱它做什麼、config 怎麼填。
- render 入口：segment 看 `render.sh`（`render__<id>()`）；line 看 `render.<runtime>`（如 `render.py`）。
- 若有 `fetch`：讀 `fetch.entry` 指的檔案 / 同檔的 fetch 分支（背景抓資料、自己寫 cache 的那段）。

讀的時候特別盯：實際打出去的網路請求 host、有沒有讀環境變數 / 檔案當 secret、有沒有 exec 外部指令或寫檔，這些要跟 `capabilities` 宣告對照——**宣告與 source 不符就是紅旗**，要明講。

## 3. 摘要給 user（vetting report）

把讀到的東西整理成一段給 user 看，至少涵蓋：

- **顯示什麼**：type（segment / line）、放哪個 slot、render 出來大概長怎樣、吃哪些 `inputs` / `CC_*` 欄位。
- **連哪些 host**：列出 source 裡實際出現的網路目的地（`requires.network` / `capabilities.network` + render/fetch 程式碼裡的 URL）。沒有網路就明說「不連外」。
- **需不需要 secret**：有沒有讀 token / API key（env var 或檔案）；要的話列出變數名與用途。沒有就說「不需要 secret」。
- **render 成本**：segment 是 in-process（zero fork，最省）；line 是每 tick fork 一個 `<runtime>` process，看 `render.ttl`（1 = 每 tick 都 fork；>N = N 秒內重用 cache）與是否有背景 `fetch`。據此說「便宜 / 中等 / 偏重」。
- **要求**：`requires.bin`（要裝的 binary）、`requires.macos` 等前置條件，本機缺的話標出來。
- **紅旗**：capability 宣告與 source 不符、連到非預期 host、抓 secret 卻沒在 README 說明等，逐條列。

摘要完用 AskUserQuestion（或直接問）請 user 確認是否安裝。**user 沒確認前不要寫任何檔案、不要動 profile。** 第三方來源若有明顯紅旗，預設建議不裝。

## 4. 安裝到 user layer（僅第三方 / 非 built-in）

確認後，把 component 目錄完整 copy 到 `~/.claude/statusline/components/<id>/`（`<id>` 取自 `component.json` 的 `id`，不是來源資料夾名）。

- 目標已存在 → 問 user 是覆蓋（升級）還是中止；覆蓋前提醒會蓋掉既有版本。
- 只 copy component 自己的檔案（manifest / render / fetch / README / config 預設檔），不要把第三方 repo 的 `.git`、無關檔案一起拖進來。
- clone 用的暫存目錄事後清掉。

> built-in 命中的情況在 Step 1 已直接跳 Step 5，這一步跳過。

## 5. 掛進當前 profile

把 component 加到 active profile 的 `components[]`（active profile 位於 user layer，由 setup 建立；不確定哪個是 active 就讀 user layer 的 profile 設定，必要時問 user）：

- 從 `component.json` 的 `placement` 取 `slot` 與 `order` 當預設；user 想換 slot（`top`/`middle`/`bottom` 給 line；`row1`/`row2` 給 segment）就照 user 的。
- 帶上 component `config.schema` 的合理預設值當 `config`；有需要 user 填的欄位（如 `symbols`、secret 對應）就問。
- 同一個 id 可以重複出現（用不同 `order` + `config` 區分，例如 ratelimit 5h / 7d），新增前先看 profile 裡是不是已經有同 id 同 config 的條目，避免重複掛。
- 已經在 profile 裡（built-in 重複 enable 的常見情形）→ 不重複新增，告訴 user「已在 profile，無須變更」。

新增條目範例（segment）：

```json
{ "id": "ctx", "slot": "row1", "order": 20, "config": {} }
```

寫回 profile 檔（保持 JSON 合法、縮排與既有風格一致）。

## 6. Preview

套用後跑一次 preview 讓 user 看實際結果——呼叫 `/statusline:preview`（或執行 loader 對 sample stdin 渲染一次）。回報：component 已裝到哪（user layer 或內建啟用）、掛在哪個 slot/order、preview 輸出，以及任何待 user 處理的事項（缺 binary、要補 secret、紅旗）。
