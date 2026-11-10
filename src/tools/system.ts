import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { askUser, canAskUser } from "../lib/elicit.js";
import { respond } from "../lib/tool.js";
import { MEDIA_KEYS, type MediaKey } from "../services/keys.js";
import { pressKeyCodes } from "../services/input.js";
import {
  formatInfo,
  formatVolume,
  getBrightness,
  getClipboard,
  getVolume,
  lockScreen,
  setBrightness,
  setClipboard,
  setVolume,
  sleepComputer,
  systemInfo,
} from "../services/system.js";

const percent = z.number().int().min(0).max(100);
const MEDIA_KEY_NAMES = Object.keys(MEDIA_KEYS) as [MediaKey, ...MediaKey[]];

async function confirmed(server: McpServer, message: string): Promise<boolean> {
  if (!canAskUser(server)) return true;
  const answers = await askUser(server, message, {
    confirm: { title: "Type yes to continue", description: "Anything else cancels." },
  });
  return answers?.confirm.toLowerCase() === "yes";
}

export function registerSystemTools(server: McpServer): void {
  server.registerTool(
    "get_volume",
    {
      title: "Get volume",
      description: "Read the speaker volume (0-100) and mute state.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => respond(async () => formatVolume(await getVolume())),
  );

  server.registerTool(
    "set_volume",
    {
      title: "Set volume",
      description: "Set the speaker volume (0-100) and/or mute or unmute.",
      inputSchema: { volume: percent.optional(), muted: z.boolean().optional() },
    },
    ({ volume, muted }) =>
      respond(async () => {
        if (volume === undefined && muted === undefined) return "Give volume (0-100) or muted (true/false).";
        return formatVolume(await setVolume(volume, muted));
      }),
  );

  server.registerTool(
    "media_key",
    {
      title: "Media key",
      description: "Press a media key: play_pause, next, previous, stop, mute, volume_up, volume_down. Works with Spotify, YouTube and most players.",
      inputSchema: { key: z.enum(MEDIA_KEY_NAMES) },
    },
    ({ key }) =>
      respond(async () => {
        await pressKeyCodes([MEDIA_KEYS[key]]);
        return `Pressed ${key}`;
      }),
  );

  server.registerTool(
    "get_brightness",
    {
      title: "Get brightness",
      description: "Read the built-in screen brightness (0-100). Laptops only.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => respond(async () => `Brightness ${await getBrightness()}%`),
  );

  server.registerTool(
    "set_brightness",
    {
      title: "Set brightness",
      description: "Set the built-in screen brightness (0-100). Laptops only.",
      inputSchema: { brightness: percent },
    },
    ({ brightness }) => respond(async () => `Brightness set to ${await setBrightness(brightness)}%`),
  );

  server.registerTool(
    "get_clipboard",
    {
      title: "Get clipboard",
      description: "Read the text on the clipboard.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () =>
      respond(async () => {
        const text = await getClipboard();
        return text ? text : "The clipboard has no text.";
      }),
  );

  server.registerTool(
    "set_clipboard",
    {
      title: "Set clipboard",
      description: "Put text on the clipboard (then press_key ctrl+v to paste it).",
      inputSchema: { text: z.string().max(100_000) },
    },
    ({ text }) =>
      respond(async () => {
        await setClipboard(text);
        return `Copied ${text.length} characters to the clipboard`;
      }),
  );

  server.registerTool(
    "system_info",
    {
      title: "System info",
      description: "Show battery, CPU load, memory, OS and uptime.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => respond(async () => formatInfo(await systemInfo())),
  );

  server.registerTool(
    "lock_screen",
    {
      title: "Lock screen",
      description: "Lock the computer (the user must sign in again).",
      inputSchema: {},
      annotations: { destructiveHint: true },
    },
    () =>
      respond(async () => {
        if (!(await confirmed(server, "Lock the computer now?"))) return "Lock cancelled.";
        return (await lockScreen()) ? "Locked the computer." : "Windows refused to lock the computer.";
      }),
  );

  server.registerTool(
    "sleep_pc",
    {
      title: "Sleep",
      description: "Put the computer to sleep. This ends the session until someone wakes the computer.",
      inputSchema: {},
      annotations: { destructiveHint: true },
    },
    () =>
      respond(async () => {
        if (!(await confirmed(server, "Put the computer to sleep now?"))) return "Sleep cancelled.";
        await sleepComputer();
        return "The computer is going to sleep.";
      }),
  );
}
