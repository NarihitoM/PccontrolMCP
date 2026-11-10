import { z } from "zod";
import { callBridge } from "../lib/powershell.js";

const volumeSchema = z.object({ volume: z.number(), muted: z.boolean() });

const infoSchema = z.object({
  computer: z.string(),
  os: z.string().optional(),
  cpu: z.string().optional(),
  cpuLoad: z.number().optional(),
  memoryTotalMb: z.number().optional(),
  memoryFreeMb: z.number().optional(),
  uptimeMinutes: z.number().optional(),
  batteryPercent: z.number().optional(),
  charging: z.boolean().optional(),
});

export type Volume = z.infer<typeof volumeSchema>;
export type SystemInfo = z.infer<typeof infoSchema>;

export function formatVolume({ volume, muted }: Volume): string {
  return `Volume ${volume}%${muted ? " (muted)" : ""}`;
}

function formatUptime(minutes: number): string {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return [days > 0 && `${days}d`, `${hours}h`, `${minutes % 60}m`].filter(Boolean).join(" ");
}

export function formatInfo(info: SystemInfo): string {
  const lines = [`Computer: ${info.computer}`];
  if (info.os) lines.push(`OS: ${info.os}`);
  if (info.cpu) lines.push(`CPU: ${info.cpu}${info.cpuLoad !== undefined && info.cpuLoad >= 0 ? ` (${info.cpuLoad}% load)` : ""}`);
  if (info.memoryTotalMb !== undefined && info.memoryFreeMb !== undefined) {
    const used = info.memoryTotalMb - info.memoryFreeMb;
    lines.push(`Memory: ${(used / 1024).toFixed(1)} / ${(info.memoryTotalMb / 1024).toFixed(1)} GB used`);
  }
  if (info.batteryPercent !== undefined) {
    lines.push(`Battery: ${info.batteryPercent}%${info.charging ? " (plugged in)" : " (on battery)"}`);
  }
  if (info.uptimeMinutes !== undefined) lines.push(`Uptime: ${formatUptime(info.uptimeMinutes)}`);
  return lines.join("\n");
}

export async function getVolume(): Promise<Volume> {
  return callBridge("get_volume", {}, volumeSchema);
}

export async function setVolume(volume?: number, muted?: boolean): Promise<Volume> {
  return callBridge("set_volume", { volume, muted }, volumeSchema);
}

export async function getBrightness(): Promise<number> {
  const { brightness } = await callBridge("get_brightness", {}, z.object({ brightness: z.number() }));
  return brightness;
}

export async function setBrightness(brightness: number): Promise<number> {
  const result = await callBridge("set_brightness", { brightness }, z.object({ brightness: z.number() }));
  return result.brightness;
}

export async function getClipboard(): Promise<string> {
  const { text } = await callBridge("get_clipboard", {}, z.object({ text: z.string() }));
  return text;
}

export async function setClipboard(text: string): Promise<void> {
  await callBridge("set_clipboard", { text }, z.object({ done: z.boolean() }));
}

export async function systemInfo(): Promise<SystemInfo> {
  return callBridge("system_info", {}, infoSchema);
}

export async function lockScreen(): Promise<boolean> {
  const { locked } = await callBridge("lock_screen", {}, z.object({ locked: z.boolean() }));
  return locked;
}

export async function sleepComputer(): Promise<void> {
  await callBridge("sleep_pc", {}, z.object({ done: z.boolean() }));
}
