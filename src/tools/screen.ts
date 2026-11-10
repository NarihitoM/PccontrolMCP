import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { respond } from "../lib/tool.js";
import { formatMonitors, listMonitors, takeScreenshot } from "../services/screen.js";
import { formatElements, readUi } from "../services/ui.js";

const DEFAULT_MAX_SIDE = 1280;
const DEFAULT_MAX_ELEMENTS = 150;

export function registerScreenTools(server: McpServer): void {
  server.registerTool(
    "get_ui",
    {
      title: "Read screen",
      description:
        "Read the foreground window (or a window handle from list_windows) as a numbered list of elements: type, name, value, id, center x,y. Prefer this over screenshot, then use tap_element with the index.",
      inputSchema: {
        maxElements: z.number().int().min(10).max(1000).default(DEFAULT_MAX_ELEMENTS),
        handle: z.number().int().optional().describe("Window handle from list_windows. Default: the foreground window"),
      },
      annotations: { readOnlyHint: true },
    },
    ({ maxElements, handle }) => respond(async () => formatElements(await readUi(maxElements, handle))),
  );

  server.registerTool(
    "screenshot",
    {
      title: "Screenshot",
      description:
        "Take a screenshot, scaled down to keep it small. Use when get_ui returns nothing useful (games, video, canvas apps). The reply says how to convert image coordinates to click coordinates.",
      inputSchema: {
        maxSide: z
          .number()
          .int()
          .min(320)
          .max(4096)
          .default(DEFAULT_MAX_SIDE)
          .describe("Longest side of the returned image in pixels"),
        monitor: z.number().int().min(0).max(16).optional().describe("Monitor index from list_monitors. Default: all screens"),
      },
      annotations: { readOnlyHint: true },
    },
    ({ maxSide, monitor }) => respond(() => takeScreenshot(maxSide, monitor)),
  );

  server.registerTool(
    "list_monitors",
    {
      title: "List monitors",
      description: "List the connected monitors with their size and position in screen coordinates.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => respond(async () => formatMonitors(await listMonitors())),
  );
}
