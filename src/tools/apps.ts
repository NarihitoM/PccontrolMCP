import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { respond } from "../lib/tool.js";
import { filterApps, launchApp, listApps, openPath, openUrl } from "../services/apps.js";

const MAX_LISTED = 200;

export function registerAppTools(server: McpServer): void {
  server.registerTool(
    "list_apps",
    {
      title: "List apps",
      description: "List installed apps from the Start menu. Use filter to search by name.",
      inputSchema: { filter: z.string().max(100).optional() },
      annotations: { readOnlyHint: true },
    },
    ({ filter }) =>
      respond(async () => {
        const apps = filterApps(await listApps(), filter);
        if (apps.length === 0) return filter ? `No apps match "${filter}".` : "No apps found.";
        const shown = apps.slice(0, MAX_LISTED).map((app) => app.name);
        const more = apps.length > MAX_LISTED ? `\n...and ${apps.length - MAX_LISTED} more (use filter)` : "";
        return `${shown.join("\n")}${more}`;
      }),
  );

  server.registerTool(
    "launch_app",
    {
      title: "Launch app",
      description: "Open an installed app by name, e.g. Spotify, Chrome, Notepad, Settings, Calculator.",
      inputSchema: { name: z.string().min(1).max(200) },
    },
    ({ name }) => respond(() => launchApp(name)),
  );

  server.registerTool(
    "open_url",
    {
      title: "Open URL",
      description: "Open an http(s) link in the default browser.",
      inputSchema: { url: z.string().min(1).max(4000) },
    },
    ({ url }) => respond(() => openUrl(url)),
  );

  server.registerTool(
    "open_path",
    {
      title: "Open file or folder",
      description:
        "Open a file with its default app, or a folder in File Explorer, e.g. C:\\Users\\me\\Downloads. Does not run programs or scripts.",
      inputSchema: { path: z.string().min(1).max(1000) },
    },
    ({ path }) => respond(() => openPath(path)),
  );
}
