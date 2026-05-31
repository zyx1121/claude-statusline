# stock-ticker

## What it shows

A left-to-right scrolling ticker of Taiwan stock quotes on its own line at the bottom of the status bar — index + named stocks with price and percent change, coloured red-up / green-down per Taiwan convention (`TWII 44,733 +2.5% · 廣達 339.00 +9.9%`).

## Data sources

- **TWSE MIS** (`mis.twse.com.tw`) — keyless public quote endpoint. One multi-symbol call per fetch. `render` only reads the local cache; `fetch` (every 60s) refreshes it.

## Config

| Key | Type | Default | Meaning |
|-----|------|---------|---------|
| `symbols` | array | `["t00","0050","2353","2382","3231"]` | TWSE symbols. `t00` = TAIEX index, 4-digit = TSE code, `otc:<code>` = TPEx-listed. |

## Requires

- `python3` on PATH
- Network access to `mis.twse.com.tw` (only during background fetch)

## Safety notes

- `render` never touches the network — it only reads the cached quotes.
- No secrets, no auth, no write outside the component's state dir.

## Example output

```
 TWII 44,733 +2.5% · 元大台灣50 105.40 +4.9% · 宏碁 35.20 +10.0% · 廣達 339.00 +9.9% · 緯創 158.50 +9.7%
```
