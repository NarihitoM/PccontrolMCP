import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { callBridge } from "../lib/powershell.js";

const SCREENSHOT_TIMEOUT_MS = 20_000;
const MAX_BASE64_LENGTH = 700 * 1024;

const monitorSchema = z.object({
  index: z.number(),
  name: z.string(),
  primary: z.boolean(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

const captureSchema = z.object({
  data: z.string(),
  format: z.enum(["png", "jpeg"]),
  x: z.number(),
  y: z.number(),
  screenWidth: z.number(),
  screenHeight: z.number(),
  width: z.number(),
  height: z.number(),
});

export type Monitor = z.infer<typeof monitorSchema>;
export type Capture = z.infer<typeof captureSchema>;

export async function listMonitors(): Promise<Monitor[]> {
  const { monitors } = await callBridge("list_monitors", {}, z.object({ monitors: z.array(monitorSchema) }));
  return monitors;
}

export function formatMonitors(monitors: Monitor[]): string {
  return monitors
    .map(
      (monitor) =>
        `[${monitor.index}] ${monitor.width}x${monitor.height} at (${monitor.x},${monitor.y})${monitor.primary ? " primary" : ""}`,
    )
    .join("\n");
}

export function describeCapture(capture: Capture): string {
  const area = `${capture.screenWidth}x${capture.screenHeight} at (${capture.x},${capture.y})`;
  const offset = capture.x !== 0 || capture.y !== 0;

  if (capture.width === capture.screenWidth) {
    return offset
      ? `Screenshot of screen area ${area}. Add (${capture.x},${capture.y}) to image coordinates for click.`
      : `Screenshot ${capture.width}x${capture.height}. Image coordinates match click coordinates.`;
  }

  const factor = (capture.screenWidth / capture.width).toFixed(3);
  const shift = offset ? `, then add (${capture.x},${capture.y})` : "";
  return `Screenshot ${capture.width}x${capture.height}, scaled from screen area ${area}. Multiply image coordinates by ${factor}${shift} for click.`;
}

export async function takeScreenshot(maxSide: number, monitor?: number): Promise<CallToolResult> {
  const capture = await callBridge(
    "screenshot",
    { maxSide, monitor, maxBase64: MAX_BASE64_LENGTH },
    captureSchema,
    SCREENSHOT_TIMEOUT_MS,
  );

  return {
    content: [
      { type: "image", data: capture.data, mimeType: `image/${capture.format}` },
      { type: "text", text: describeCapture(capture) },
    ],
  };
}
