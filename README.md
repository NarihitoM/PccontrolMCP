# PC Control MCP

Control your Windows PC from Claude (or any MCP client) by just asking:
"open Spotify and play my liked songs", "turn the volume down to 20", "close all Chrome windows",
"what's on my screen?".

It reads the screen through Windows UI Automation, moves the mouse, types, manages windows and apps,
and changes volume and brightness. Nothing extra to install: it uses the PowerShell and .NET that ship
with Windows. Windows 10 and 11 only.

---

## Quick start (one command)

You need [Node.js 20 or newer](https://nodejs.org).

```
npm install -g pc-mcp-by-narihito
pc-mcp setup
```

Or run it without installing: `npx pc-mcp-by-narihito setup`

The setup:

1. Checks that this PC works with the server (prints battery, CPU and memory to prove it).
2. Adds the `pc` server to every AI tool it finds: Claude Code, Claude Desktop, Cursor, VS Code,
   Windsurf, Gemini CLI, Codex CLI and OpenCode. Your other MCP servers are kept and a `.bak` backup
   is made of each config file.

Restart your AI tool and ask "what windows are open on my PC?".

| Option | What it does |
|--------|--------------|
| `--yes`, `-y` | Add to every AI tool found without asking |
| `--clients cursor,vscode` | Only set up these tools |

---

## Let your AI agent set it up

Paste this into an AI agent that can run terminal commands (Claude Code, Codex CLI, Gemini CLI,
Cursor agent mode, OpenCode):

```
Install the PC control MCP server: run `npm install -g pc-mcp-by-narihito`, then
`pc-mcp setup --yes`. Tell me when it is done so I can restart and try it.
```

---

## Manual setup

```
git clone https://github.com/NarihitoM/PccontrolMCP.git
cd PccontrolMCP
npm install
```

Then add it to your MCP client, using the absolute path to `dist/index.js`:

**Claude Code**

```
claude mcp add pc -s user -- node "C:\path\to\PcMCP\dist\index.js"
```

**Claude Desktop, Cursor, Windsurf, Gemini CLI** (`mcpServers` in the tool's config file)

```json
{
  "mcpServers": {
    "pc": { "command": "node", "args": ["C:\\path\\to\\PcMCP\\dist\\index.js"] }
  }
}
```

**VS Code** (`%APPDATA%\Code\User\mcp.json`)

```json
{
  "servers": {
    "pc": { "type": "stdio", "command": "node", "args": ["C:\\path\\to\\PcMCP\\dist\\index.js"] }
  }
}
```

---

## How it works

The server starts one hidden PowerShell process. PowerShell compiles the C# files in [`bridge/`](bridge)
once (cached in `%LOCALAPPDATA%\pc-mcp`) and then answers requests over stdin/stdout. The C# code calls
standard Windows APIs: `SendInput` for mouse and keyboard, UI Automation to read windows, GDI+ for
screenshots and Core Audio for volume. All of it is plain source you can read in this repo.

Coordinates are physical screen pixels, the same in `get_ui`, `screenshot` and `click`.

---

## Tools

| Tool | What it does |
|------|--------------|
| `get_ui` | Read the foreground window (or any window) as a numbered list of elements |
| `screenshot` | Screenshot of all screens or one monitor, scaled down, with click conversion |
| `list_monitors` | Monitors with size and position |
| `click` | Click at x,y (left, right, middle, double) |
| `tap_element` | Click an element from `get_ui` by index (presses buttons directly when possible) |
| `move_mouse` | Hover at x,y |
| `drag` | Drag from one point to another |
| `scroll` | Mouse wheel up, down, left, right |
| `type_text` | Type any text, optionally into a `get_ui` element and replacing its content |
| `press_key` | Keys and shortcuts: `enter`, `ctrl+c`, `alt+tab`, `win+d`, `ctrl+shift+esc`... |
| `wait` | Wait for the screen to settle |
| `list_windows` | Open windows with handle, title, app and position |
| `focus_window` | Bring a window to the front by title, app name or handle |
| `window_action` | Minimize, maximize, restore or close a window |
| `list_apps` | Installed Start menu apps |
| `launch_app` | Open an app by name |
| `open_url` | Open an http(s) link in the default browser |
| `open_path` | Open a file or folder (never runs programs or scripts) |
| `get_volume` / `set_volume` | Speaker volume and mute |
| `media_key` | Play/pause, next, previous, stop, mute, volume up/down |
| `get_brightness` / `set_brightness` | Built-in screen brightness (laptops) |
| `get_clipboard` / `set_clipboard` | Clipboard text |
| `system_info` | Battery, CPU load, memory, OS, uptime |
| `lock_screen` | Lock the PC (asks you first when the client supports it) |
| `sleep_pc` | Put the PC to sleep (asks you first when the client supports it) |

---

## Troubleshooting

- **`get_ui` shows only a few elements in Chrome, VS Code, Discord or other Electron apps.** These apps
  build their accessibility tree on the first request. The server retries once automatically. If it
  is still short, call `get_ui` again or use `screenshot`.
- **Clicks or typing do nothing in one window.** Windows blocks input into apps running as
  administrator (Task Manager, some installers and games) unless your AI tool also runs as administrator.
- **`focus_window` says another window kept the focus.** Windows limits focus stealing. Click the window
  or its taskbar button instead.
- **Brightness is not available.** It only works on built-in laptop screens, not external monitors.
- **The first call takes a few seconds.** The helper compiles once and is cached afterwards; later
  starts take about one second.
- **Antivirus.** All logic is compiled C# from `bridge/`, so Windows Defender does not need to scan a
  large PowerShell script. If your antivirus still blocks it, allow the `%LOCALAPPDATA%\pc-mcp` folder.

---

## Security

- The server talks to your MCP client only on your computer (stdio). It opens no network port and
  sends nothing anywhere.
- There is no shell or file-writing tool. `open_path` refuses programs and scripts, and `open_url` only
  opens http and https links.
- `lock_screen`, `sleep_pc` and `window_action` are marked destructive, so clients ask before running them.
- Claude can do anything you can do with a mouse and keyboard. Watch what it does, especially in
  email, banking, payment or admin tools.

---

## Development

```
npm install
npm run build        # compile TypeScript to dist/
npm test             # build and run unit tests
npm run typecheck    # type-check only
npm run inspect      # try the tools in MCP Inspector
```

```
bridge/              C# helper compiled by PowerShell (input, windows, UI Automation, screen, audio)
src/
  index.ts           CLI entry: setup, help, or start the server
  server.ts          MCP server and instructions
  cli/               setup wizard
  lib/               PowerShell bridge, reply protocol, tool helpers
  services/          screen, ui, input, keys, windows, apps, system
  setup/             AI client detection and config writing
  tools/             MCP tool definitions
```
