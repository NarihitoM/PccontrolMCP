import { z } from "zod";
import { callBridge, stopBridge } from "../dist/lib/powershell.js";

const reply = await callBridge("ping", {}, z.object({ pong: z.boolean() }));
stopBridge();

if (!reply.pong) {
  console.error("Bridge did not answer the ping");
  process.exit(1);
}
console.log("Bridge compiled and answered the ping");
