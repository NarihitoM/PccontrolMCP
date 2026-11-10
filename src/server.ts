import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { packageVersion } from "./lib/package.js";
import { registerAppTools } from "./tools/apps.js";
import { registerInputTools } from "./tools/input.js";
import { registerScreenTools } from "./tools/screen.js";
import { registerSystemTools } from "./tools/system.js";
import { registerWindowTools } from "./tools/windows.js";

const INSTRUCTIONS =
  "Controls this Windows PC: screen, mouse, keyboard, windows, apps and system settings. Typical loop: get_ui to read the foreground window, tap_element / type_text / press_key to act, wait briefly, then get_ui again to confirm. Use launch_app or focus_window to bring an app forward first. Use screenshot only when get_ui has no useful elements (games, video, canvas apps), and convert its image coordinates as the reply says before click. Coordinates are physical screen pixels.";

export function createServer(): McpServer {
  const server = new McpServer({ name: "pc-control", version: packageVersion() }, { instructions: INSTRUCTIONS });

  registerScreenTools(server);
  registerInputTools(server);
  registerWindowTools(server);
  registerAppTools(server);
  registerSystemTools(server);

  return server;
}

export async function startServer(): Promise<void> {
  await createServer().connect(new StdioServerTransport());
}
