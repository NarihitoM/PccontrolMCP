import { z } from "zod";
import { callBridge } from "../lib/powershell.js";
import { parseCombo } from "./keys.js";

const doneSchema = z.object({ done: z.boolean() });
const TYPE_TIMEOUT_MS = 60_000;
const TYPE_DELAY_MS = 45;
const PRESS_TIMEOUT_MS = 15_000;
const PRESS_REPEAT_MS = 500;

export type MouseButton = "left" | "right" | "middle";
export type ScrollDirection = "up" | "down" | "left" | "right";

export async function moveMouse(x: number, y: number, animate = true): Promise<void> {
  await callBridge("move_mouse", { x, y, animate }, doneSchema);
}

export async function click(
  x: number,
  y: number,
  button: MouseButton,
  count: number,
  animate = true,
): Promise<void> {
  await callBridge("click", { x, y, button, count, animate }, doneSchema);
}

export async function drag(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  durationMs: number,
  animate = true,
): Promise<void> {
  await callBridge("drag", { x1, y1, x2, y2, durationMs, animate }, doneSchema, durationMs + 10_000);
}

export function scrollAmount(direction: ScrollDirection, amount: number): { amount: number; horizontal: boolean } {
  const horizontal = direction === "left" || direction === "right";
  const sign = direction === "up" || direction === "right" ? 1 : -1;
  return { amount: sign * amount, horizontal };
}

export async function scroll(
  direction: ScrollDirection,
  amount: number,
  x?: number,
  y?: number,
  animate = true,
): Promise<void> {
  await callBridge("scroll", { ...scrollAmount(direction, amount), x, y, animate }, doneSchema);
}

export async function typeText(text: string, animate = true): Promise<void> {
  await callBridge("type_text", { text, delayMs: animate ? TYPE_DELAY_MS : 0 }, doneSchema, TYPE_TIMEOUT_MS);
}

export async function pressCombo(combo: string, repeat: number, animate = true): Promise<void> {
  await callBridge(
    "press_keys",
    { keys: parseCombo(combo), repeat, animate },
    doneSchema,
    PRESS_TIMEOUT_MS + repeat * PRESS_REPEAT_MS,
  );
}

export async function pressKeyCodes(keys: number[]): Promise<void> {
  await callBridge("press_keys", { keys, repeat: 1, animate: false }, doneSchema);
}
