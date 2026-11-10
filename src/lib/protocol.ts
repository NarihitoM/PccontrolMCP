import { z } from "zod";

const readySchema = z.object({ ready: z.literal(true) });

const replySchema = z.discriminatedUnion("ok", [
  z.object({ id: z.number(), ok: z.literal(true), result: z.unknown() }),
  z.object({ id: z.number(), ok: z.literal(false), error: z.string() }),
]);

export type BridgeReply =
  | { kind: "ready" }
  | { kind: "result"; id: number; ok: true; result: unknown }
  | { kind: "result"; id: number; ok: false; error: string };

export function parseReply(line: string): BridgeReply | null {
  const text = line.replace(/^﻿/, "").trim();
  if (!text.startsWith("{")) return null;

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }

  if (readySchema.safeParse(value).success) return { kind: "ready" };
  const reply = replySchema.safeParse(value);
  if (!reply.success) return null;
  return { kind: "result", ...reply.data };
}
