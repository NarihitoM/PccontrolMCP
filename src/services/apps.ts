import { extname } from "node:path";
import { z } from "zod";
import { callBridge } from "../lib/powershell.js";

const APPS_TIMEOUT_MS = 30_000;
const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".com", ".bat", ".cmd", ".ps1", ".psm1", ".vbs", ".vbe", ".js", ".jse", ".wsf", ".wsh", ".msi", ".msp",
  ".msc", ".scr", ".lnk", ".url", ".reg", ".hta", ".cpl", ".pif", ".jar", ".appref-ms",
]);

const appSchema = z.object({ name: z.string(), id: z.string() });
const doneSchema = z.object({ done: z.boolean() });

export type StartApp = z.infer<typeof appSchema>;

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

export async function listApps(): Promise<StartApp[]> {
  const { apps } = await callBridge("list_apps", {}, z.object({ apps: z.array(appSchema) }), APPS_TIMEOUT_MS);
  return apps;
}

export function filterApps(apps: StartApp[], filter?: string): StartApp[] {
  const query = filter?.trim().toLowerCase();
  if (!query) return apps;
  return apps.filter((app) => app.name.toLowerCase().includes(query));
}

export function matchApp(apps: StartApp[], name: string): StartApp | undefined {
  const query = name.trim().toLowerCase();
  if (!query) return undefined;
  const byName = (test: (appName: string) => boolean) => apps.find((app) => test(app.name.toLowerCase()));
  return (
    byName((appName) => appName === query) ??
    byName((appName) => appName.startsWith(query)) ??
    byName((appName) => appName.split(/[\s\-_.]+/).includes(query)) ??
    byName((appName) => appName.includes(query))
  );
}

export async function launchApp(name: string): Promise<string> {
  const app = matchApp(await listApps(), name);
  if (app) {
    await callBridge("start_app", { id: app.id }, doneSchema);
    return `Launched ${app.name}`;
  }

  const missing = new AppError(`No app named "${name}". Call list_apps to see the installed apps.`);
  if (/[\\/:]/.test(name)) throw missing;
  await callBridge("start_program", { name: name.trim() }, doneSchema).catch(() => {
    throw missing;
  });
  return `Launched ${name.trim()}`;
}

export function checkUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new AppError(`"${raw}" is not a valid URL. Include https://`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppError("Only http and https links can be opened.");
  }
  return url.toString();
}

export function checkPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) throw new AppError("Give a file or folder path.");
  if (BLOCKED_EXTENSIONS.has(extname(trimmed).toLowerCase())) {
    throw new AppError("open_path does not run programs or scripts. Use launch_app to start an app.");
  }
  return trimmed;
}

export async function openUrl(url: string): Promise<string> {
  const target = checkUrl(url);
  await callBridge("open_target", { target, kind: "url" }, doneSchema);
  return `Opened ${target}`;
}

export async function openPath(path: string): Promise<string> {
  const target = checkPath(path);
  await callBridge("open_target", { target, kind: "path" }, doneSchema);
  return `Opened ${target}`;
}
