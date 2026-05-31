# nowplaying

## What it shows

The currently-playing track, formatted as `♪ <name> — <artist>` (a magenta note glyph plus base-colored text), truncated to 44 characters. The segment only appears when Apple Music or Spotify is actively **playing**; if no player is running, playback is paused, or the track info can't be read, the whole segment is hidden.

## Data sources

- `pgrep -x Spotify` / `pgrep -x Music` — detects which player is running (Spotify takes priority).
- `osascript` sends an AppleEvent to that player to read `player state` and the `current track`'s `name` / `artist`.
- Reads no stdin (`CC_*`) fields (`inputs: []`).

## Config

None. The `config` block in `component.json` is empty.

## Requires

- macOS, and your terminal / the Claude Code host process must be granted **Automation (AppleEvents/TCC)** permission to control Music / Spotify.
- `requires.macos: ["AppleEvents"]`.

## Safety notes

- **The pgrep gate must stay**: `pgrep` confirms a player is running before `osascript` is called. Without it, `osascript` would trigger the AppleEvents/TCC authorization prompt even when no player is up — and could even launch a stopped app.
- The app name is passed into the tell block as a **literal** (`"Spotify"` / `"Music"`) rather than a variable, so the scripting dictionary can resolve it at compile time; a variable name can't be statically resolved.
- All `osascript` errors are swallowed with `2>/dev/null` and return an empty string. The renderer treats empty as hidden, so no error is ever printed to the statusline.

## Example output

```
♪ Bohemian Rhapsody — Queen
```
