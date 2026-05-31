---
name: configure
description: Configure a statusline component's tunable knobs and write them to the user-layer config (never into the component dir or repo). Use when the user runs /statusline:configure <component>, or asks to "set up", "tune", "change the config / symbols / options of" a statusline component, or "add my API key / token" to one.
---

# /statusline:configure <component>

調整單一 component 的設定值，寫進 **user layer**（`~/.claude/statusline/config/<id>.json`），絕不寫回 component 目錄或 repo。component 目錄裡的 `component.json` 只是 schema + 預設值的來源，是唯讀的。

`$1` = component id（例如 `stock-ticker`、`ctx`）。若使用者沒給，先列出可用 component（user layer 與 plugin 內建）讓他選。

## Procedure

1. **Resolve the component.** 依 search path 找 `component.json`，user layer 優先：
   - `~/.claude/statusline/components/$1/component.json`
   - 否則 plugin 內建 `${CLAUDE_PLUGIN_ROOT}/components/$1/component.json`

   找不到就停下，列出兩層所有可用 id 請使用者改用正確名稱。

2. **Read the schema.** 取出 `.config.schema`。它是一個 object，每個 key 是一個可調旋鈕：
   - `type`：`string` / `number` / `boolean` / `array` / `object`
   - `default`：預設值
   - `desc`：人類可讀說明

   若 `.config.schema` 為空 `{}`（例如 `ctx`），告訴使用者此 component 無可調項目，結束。

3. **Show the knobs.** 用表格列出每個 key、type、目前生效值、預設值與說明。
   - 目前生效值：若 `~/.claude/statusline/config/$1.json` 已存在，讀出該 key 的現值；否則顯示 `default`。
   - 同時提醒：同一 component 可在多個 profile slot 以不同 `order` + `config` 出現（例如 `ratelimit` 的 `window:"5h"` 與 `window:"7d"`）。**本指令寫的是該 component 的「使用者預設值」**；若使用者要的是「某個 profile 裡這顆 instance 專屬的覆寫」，那要直接編輯該 profile 的 `components[].config`（per-instance config 會疊在這份預設值之上），本指令不碰 profile。

4. **Collect values.** 對每個旋鈕詢問新值（直接 Enter 保留現值）。寫入前依 `type` 驗證：
   - `array`：逗號或換行分隔 → 轉成 JSON 陣列；尊重 `desc` 裡的格式提示（如 stock-ticker 的 `t00` / `otc:<code>`）。
   - `number` / `boolean`：轉成對應 JSON 型別，不要存成字串。
   - 未在 schema 出現的 key 一律拒絕，避免拼錯靜默失效。

5. **NEVER put secrets in the config JSON.** 任何 API key / token / 密碼 / cookie：
   - **禁止**寫進 `~/.claude/statusline/config/$1.json`，更不可寫進 repo 或 component 目錄。
   - 正確去處（依平台擇一）：
     - macOS：`security add-generic-password -s statusline-<id> -a <key> -w <secret>`（component 在 `fetch` 時自己 `security find-generic-password` 取回）。
     - Linux：`secret-tool` / `pass`，或一個 **gitignored** 檔案 `~/.claude/statusline/secrets/<id>.env`（`chmod 600`）。
   - config JSON 裡只放「去哪裡拿密鑰」的指標（如 `keychain_service`、`env_var`、`secret_file`），不放密鑰本身。
   - 若該 component 的 `requires.network` 非空且 schema 含疑似密鑰欄位，主動套用以上規則並向使用者說明。

6. **Merge and write.** 讀現有 `~/.claude/statusline/config/$1.json`（沒有就空 `{}`），把使用者改動的 key 合併進去（只覆寫有動到的，保留其餘），確保 `~/.claude/statusline/config/` 目錄存在，寫回格式化過的 JSON。**只寫這個路徑** — 再次確認沒有碰到 component 目錄或 repo 內任何檔案。

7. **Preview.** 套用後執行 `/statusline:preview` 渲染目前 profile，讓使用者看到效果。提醒：line widget 若有 `fetch.ttl`，新值要到下一次 fetch 週期才會反映；可刪掉該 component 的快取以立即重抓。

## Notes

- user layer config 路徑：`~/.claude/statusline/config/<id>.json` — 升級 plugin 不會被覆蓋，這正是不寫回 component 目錄的原因。
- 某些 component 的 `component.json` 有 `config.file`（如 stock-ticker 的 `symbols.default`）指向目錄內附的預設資料檔；那是**唯讀範本**，使用者的值一律走上面的 user-layer JSON，別去改範本檔。
- 不確定某顆旋鈕語意時，照 `desc` 原文呈現給使用者，不要自行臆測或擴充含義。
