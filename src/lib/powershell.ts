import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { z } from "zod";
import { parseReply } from "./protocol.js";

const START_TIMEOUT_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 15_000;
const LOG_LINES = 20;
const SCRIPT_PATH = fileURLToPath(new URL("../../bridge/host.ps1", import.meta.url));
const ARGS = ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", SCRIPT_PATH];

export class PowerShellError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PowerShellError";
  }
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

interface Session {
  child: ChildProcessWithoutNullStreams;
  ready: Promise<void>;
  pending: Map<number, Pending>;
  log: string[];
}

let session: Session | null = null;
let nextId = 1;
let exitHookInstalled = false;

function installExitHook(): void {
  if (exitHookInstalled) return;
  exitHookInstalled = true;
  process.once("exit", () => session?.child.kill());
}

function remember(log: string[], text: string): void {
  log.push(...text.split(/\r?\n/).filter(Boolean));
  if (log.length > LOG_LINES) log.splice(0, log.length - LOG_LINES);
}

function failAll(current: Session, error: Error): void {
  for (const pending of current.pending.values()) {
    clearTimeout(pending.timer);
    pending.reject(error);
  }
  current.pending.clear();
}

function stop(current: Session, reason: string): void {
  if (session === current) session = null;
  failAll(current, new PowerShellError(reason));
  current.child.kill();
}

function describeExit(log: string[], code: number | null): string {
  const detail = log.length > 0 ? `\n${log.join("\n")}` : "";
  return `The PowerShell helper stopped (exit code ${code ?? "unknown"}).${detail}`;
}

function start(): Session {
  installExitHook();
  const child = spawn("powershell.exe", ARGS, { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  const pending = new Map<number, Pending>();
  const log: string[] = [];
  let buffer = "";
  let markReady: () => void = () => undefined;
  let markFailed: (error: Error) => void = () => undefined;

  const ready = new Promise<void>((resolve, reject) => {
    markReady = resolve;
    markFailed = reject;
  });
  const current: Session = { child, ready, pending, log };

  const startTimer = setTimeout(() => {
    markFailed(new PowerShellError("The PowerShell helper took too long to start."));
    stop(current, "The PowerShell helper took too long to start.");
  }, START_TIMEOUT_MS);

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");

      const reply = parseReply(line);
      if (!reply) {
        remember(log, line);
        continue;
      }
      if (reply.kind === "ready") {
        clearTimeout(startTimer);
        markReady();
        continue;
      }
      const waiting = pending.get(reply.id);
      if (!waiting) continue;
      pending.delete(reply.id);
      clearTimeout(waiting.timer);
      if (reply.ok) waiting.resolve(reply.result);
      else waiting.reject(new PowerShellError(reply.error));
    }
  });

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => remember(log, chunk));

  child.once("error", (error) => {
    clearTimeout(startTimer);
    const message = `Could not start PowerShell: ${error.message}`;
    markFailed(new PowerShellError(message));
    stop(current, message);
  });

  child.once("close", (code) => {
    clearTimeout(startTimer);
    const message = describeExit(log, code);
    markFailed(new PowerShellError(message));
    if (session === current) session = null;
    failAll(current, new PowerShellError(message));
  });

  child.stdin.on("error", () => undefined);
  return current;
}

async function ensureSession(): Promise<Session> {
  if (process.platform !== "win32") throw new PowerShellError("pc-mcp only supports Windows.");
  if (!session) session = start();
  const current = session;
  await current.ready;
  return current;
}

export async function callBridge<Schema extends z.ZodType>(
  op: string,
  args: Record<string, unknown>,
  schema: Schema,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<z.infer<Schema>> {
  const current = await ensureSession();
  const id = nextId++;

  const result = await new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => {
      current.pending.delete(id);
      reject(new PowerShellError(`${op} timed out after ${timeoutMs}ms.`));
      stop(current, `Restarting the PowerShell helper after ${op} timed out.`);
    }, timeoutMs);
    current.pending.set(id, { resolve, reject, timer });
    current.child.stdin.write(`${JSON.stringify({ id, op, args })}\n`);
  });

  const parsed = schema.safeParse(result);
  if (!parsed.success) throw new PowerShellError(`Unexpected reply from ${op}: ${parsed.error.message}`);
  return parsed.data;
}

export function stopBridge(): void {
  if (session) stop(session, "The PowerShell helper was stopped.");
}
