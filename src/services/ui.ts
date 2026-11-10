import { z } from "zod";
import { callBridge } from "../lib/powershell.js";
import { windowLabel, windowSchema } from "./windows.js";

const READ_TIMEOUT_MS = 30_000;
const MAX_TEXT = 80;

const elementSchema = z.object({
  index: z.number(),
  type: z.string(),
  name: z.string(),
  value: z.string(),
  automationId: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  enabled: z.boolean(),
  focused: z.boolean(),
});

const readSchema = z.object({
  window: windowSchema,
  elements: z.array(elementSchema),
  truncated: z.boolean(),
});

export type UiElement = z.infer<typeof elementSchema>;
export type UiRead = z.infer<typeof readSchema>;

let lastRead: UiElement[] = [];

export class UiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UiError";
  }
}

export function center(element: UiElement): { x: number; y: number } {
  return { x: Math.round(element.x + element.width / 2), y: Math.round(element.y + element.height / 2) };
}

function shorten(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > MAX_TEXT ? `${flat.slice(0, MAX_TEXT - 3)}...` : flat;
}

export function elementLabel(element: UiElement): string {
  return shorten(element.name) || shorten(element.value) || element.automationId || element.type;
}

export function formatElements(read: UiRead): string {
  const header = `Window ${windowLabel(read.window)} [${read.window.handle}]`;
  if (read.elements.length === 0) {
    return `${header}\nNo readable elements. Use screenshot to see it.`;
  }

  const lines = read.elements.map((element) => {
    const { x, y } = center(element);
    const parts = [`[${element.index}]`, element.type];
    if (element.name) parts.push(JSON.stringify(shorten(element.name)));
    if (element.value && element.value !== element.name) parts.push(`value=${JSON.stringify(shorten(element.value))}`);
    if (element.automationId) parts.push(`id=${element.automationId}`);
    parts.push(`(${x},${y})`);

    const flags = [!element.enabled && "disabled", element.focused && "focused"].filter(Boolean);
    if (flags.length > 0) parts.push(flags.join(","));
    return parts.join(" ");
  });

  const footer = read.truncated ? "\n(more elements not shown: raise maxElements or focus a smaller window)" : "";
  return `${header}\n${lines.join("\n")}${footer}`;
}

export async function readUi(maxElements: number, handle?: number): Promise<UiRead> {
  const read = await callBridge("get_ui", { maxElements, handle }, readSchema, READ_TIMEOUT_MS);
  lastRead = read.elements;
  return read;
}

export function findElement(index: number): UiElement {
  if (lastRead.length === 0) throw new UiError("No screen read yet. Call get_ui first.");
  const element = lastRead[index];
  if (!element) throw new UiError(`Element ${index} not found. Call get_ui again to refresh.`);
  return element;
}

export async function invokeElement(index: number): Promise<boolean> {
  const { invoked } = await callBridge("invoke_element", { index }, z.object({ invoked: z.boolean() }));
  return invoked;
}

export async function focusElement(index: number): Promise<void> {
  await callBridge("focus_element", { index }, z.object({ done: z.boolean() }));
}
