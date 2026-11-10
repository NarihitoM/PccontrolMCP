import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { respond } from "../lib/tool.js";
import { click, drag, moveMouse, pressCombo, scroll, typeText } from "../services/input.js";
import { center, elementLabel, findElement, focusElement, invokeElement } from "../services/ui.js";

const MAX_WAIT_MS = 30_000;
const coordinate = z.number().int().min(-20_000).max(40_000);
const button = z.enum(["left", "right", "middle"]).default("left");

export function registerInputTools(server: McpServer): void {
  server.registerTool(
    "click",
    {
      title: "Click",
      description: "Click at x,y screen pixels. Set double for a double-click, button for right/middle click.",
      inputSchema: { x: coordinate, y: coordinate, button, double: z.boolean().default(false) },
    },
    ({ x, y, button, double }) =>
      respond(async () => {
        await click(x, y, button, double ? 2 : 1);
        return `${double ? "Double-clicked" : "Clicked"} ${button} at (${x},${y})`;
      }),
  );

  server.registerTool(
    "tap_element",
    {
      title: "Click element",
      description:
        "Click an element by its index from the last get_ui call. A plain left click presses buttons and links directly when possible, otherwise clicks the element's center.",
      inputSchema: { index: z.number().int().min(0).max(10_000), button, double: z.boolean().default(false) },
    },
    ({ index, button, double }) =>
      respond(async () => {
        const element = findElement(index);
        const label = elementLabel(element);
        if (button === "left" && !double && (await invokeElement(index).catch(() => false))) {
          return `Pressed [${index}] ${label}`;
        }
        const { x, y } = center(element);
        await click(x, y, button, double ? 2 : 1);
        return `${double ? "Double-clicked" : "Clicked"} [${index}] ${label} at (${x},${y})`;
      }),
  );

  server.registerTool(
    "move_mouse",
    {
      title: "Move mouse",
      description: "Move the mouse pointer to x,y screen pixels without clicking (for hover menus and tooltips).",
      inputSchema: { x: coordinate, y: coordinate },
    },
    ({ x, y }) =>
      respond(async () => {
        await moveMouse(x, y);
        return `Moved mouse to (${x},${y})`;
      }),
  );

  server.registerTool(
    "drag",
    {
      title: "Drag",
      description: "Drag with the left mouse button from (x1,y1) to (x2,y2), e.g. to move files, sliders or windows.",
      inputSchema: {
        x1: coordinate,
        y1: coordinate,
        x2: coordinate,
        y2: coordinate,
        durationMs: z.number().int().min(50).max(5000).default(400),
      },
    },
    ({ x1, y1, x2, y2, durationMs }) =>
      respond(async () => {
        await drag(x1, y1, x2, y2, durationMs);
        return `Dragged (${x1},${y1}) -> (${x2},${y2})`;
      }),
  );

  server.registerTool(
    "scroll",
    {
      title: "Scroll",
      description: "Scroll the mouse wheel. Give x,y to scroll over a specific spot first.",
      inputSchema: {
        direction: z.enum(["up", "down", "left", "right"]),
        amount: z.number().int().min(1).max(50).default(3).describe("Wheel notches"),
        x: coordinate.optional(),
        y: coordinate.optional(),
      },
    },
    ({ direction, amount, x, y }) =>
      respond(async () => {
        await scroll(direction, amount, x, y);
        return `Scrolled ${direction} ${amount}`;
      }),
  );

  server.registerTool(
    "type_text",
    {
      title: "Type text",
      description:
        "Type text into the focused field (any language, emoji, new lines). Give index to focus a get_ui element first, and clear to replace what is already there.",
      inputSchema: {
        text: z.string().max(10_000),
        index: z.number().int().min(0).max(10_000).optional(),
        clear: z.boolean().default(false),
      },
    },
    ({ text, index, clear }) =>
      respond(async () => {
        if (index !== undefined) {
          findElement(index);
          await focusElement(index);
        }
        if (clear) {
          await pressCombo("ctrl+a", 1);
          await pressCombo("delete", 1);
        }
        await typeText(text);
        return `Typed ${text.length} characters`;
      }),
  );

  server.registerTool(
    "press_key",
    {
      title: "Press key",
      description:
        "Press a key or shortcut, e.g. enter, esc, tab, ctrl+c, ctrl+shift+esc, alt+tab, alt+f4, win+d, win+e, f5. Join keys with +.",
      inputSchema: {
        keys: z.string().min(1).max(100),
        repeat: z.number().int().min(1).max(50).default(1),
      },
    },
    ({ keys, repeat }) =>
      respond(async () => {
        await pressCombo(keys, repeat);
        return `Pressed ${keys}${repeat > 1 ? ` x${repeat}` : ""}`;
      }),
  );

  server.registerTool(
    "wait",
    {
      title: "Wait",
      description: "Wait for the screen to settle, e.g. after opening an app or loading a page.",
      inputSchema: { ms: z.number().int().min(0).max(MAX_WAIT_MS).default(1000) },
      annotations: { readOnlyHint: true },
    },
    ({ ms }) =>
      respond(async () => {
        await new Promise((resolve) => setTimeout(resolve, ms));
        return `Waited ${ms}ms`;
      }),
  );
}
