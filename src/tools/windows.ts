import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { respond } from "../lib/tool.js";
import { actOnWindow, focusWindow, formatWindows, listWindows, windowLabel } from "../services/windows.js";

const query = z.string().max(200).optional().describe("Part of the window title or app name, e.g. chrome, notepad");
const handle = z.number().int().optional().describe("Exact window handle from list_windows");

const PAST_TENSE = { minimize: "Minimized", maximize: "Maximized", restore: "Restored", close: "Asked to close" } as const;

export function registerWindowTools(server: McpServer): void {
  server.registerTool(
    "list_windows",
    {
      title: "List windows",
      description: "List open app windows with handle, title, app and position. The foreground window is marked with *.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () =>
      respond(async () => {
        const { windows, foreground } = await listWindows();
        return formatWindows(windows, foreground);
      }),
  );

  server.registerTool(
    "focus_window",
    {
      title: "Focus window",
      description: "Bring a window to the front (restores it if minimized). Find it by title/app name or handle.",
      inputSchema: { query, handle },
    },
    ({ query, handle }) =>
      respond(async () => {
        const { window, focused } = await focusWindow({ query, handle });
        return focused
          ? `Focused ${windowLabel(window)}`
          : `Asked Windows to focus ${windowLabel(window)}, but another window kept the focus. Try clicking it.`;
      }),
  );

  server.registerTool(
    "window_action",
    {
      title: "Window action",
      description: "Minimize, maximize, restore or close a window, found by title/app name or handle. Close may show a save prompt.",
      inputSchema: { action: z.enum(["minimize", "maximize", "restore", "close"]), query, handle },
      annotations: { destructiveHint: true },
    },
    ({ action, query, handle }) =>
      respond(async () => {
        const window = await actOnWindow({ query, handle }, action);
        return `${PAST_TENSE[action]} ${windowLabel(window)}`;
      }),
  );
}
