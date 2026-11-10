import { z } from "zod";
import { callBridge } from "../lib/powershell.js";

export const windowSchema = z.object({
  handle: z.number(),
  title: z.string(),
  process: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  minimized: z.boolean(),
  maximized: z.boolean(),
});

export type WindowInfo = z.infer<typeof windowSchema>;

export type WindowAction = "minimize" | "maximize" | "restore" | "close";

export interface WindowTarget {
  query?: string;
  handle?: number;
}

export class WindowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WindowError";
  }
}

function targetArgs(target: WindowTarget): Record<string, unknown> {
  if (target.handle !== undefined) return { handle: target.handle };
  if (target.query?.trim()) return { query: target.query.trim() };
  throw new WindowError("Give a window title / app name (query) or a handle from list_windows.");
}

export function windowLabel(window: WindowInfo): string {
  return `"${window.title.trim()}" (${window.process || "unknown"})`;
}

export function formatWindows(windows: WindowInfo[], foreground: number): string {
  if (windows.length === 0) return "No open windows.";
  return windows
    .map((window) => {
      const marker = window.handle === foreground ? "*" : " ";
      const state = window.minimized ? " minimized" : window.maximized ? " maximized" : "";
      return `${marker} [${window.handle}] ${windowLabel(window)} ${window.width}x${window.height} at (${window.x},${window.y})${state}`;
    })
    .join("\n");
}

export async function listWindows(): Promise<{ windows: WindowInfo[]; foreground: number }> {
  return callBridge("list_windows", {}, z.object({ foreground: z.number(), windows: z.array(windowSchema) }));
}

export async function focusWindow(target: WindowTarget): Promise<{ window: WindowInfo; focused: boolean }> {
  return callBridge("focus_window", targetArgs(target), z.object({ window: windowSchema, focused: z.boolean() }));
}

export async function actOnWindow(target: WindowTarget, action: WindowAction): Promise<WindowInfo> {
  const { window } = await callBridge(
    "window_action",
    { ...targetArgs(target), action },
    z.object({ window: windowSchema }),
  );
  return window;
}
