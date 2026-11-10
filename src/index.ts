#!/usr/bin/env node
import { PACKAGE_NAME, packageVersion } from "./lib/package.js";

const HELP = `${PACKAGE_NAME} ${packageVersion()}

Control your Windows PC from AI tools (Claude, Cursor, Codex, Gemini, OpenCode...):
screen, mouse, keyboard, windows, apps, volume, brightness and more.

Usage:
  pc-mcp setup        Check this PC and add the pc server to your AI tools
  pc-mcp              Start the MCP server (your AI tool runs this)

Setup options:
  --yes               Add to every AI tool found, without asking
  --clients a,b       Only these tools: claude-code, claude-desktop, cursor, vscode,
                      windsurf, gemini, codex, opencode

Run with npx without installing:  npx ${PACKAGE_NAME} setup`;

const [command] = process.argv.slice(2);

if (command === "setup") {
  const { runSetupCommand } = await import("./cli/setup.js");
  await runSetupCommand(process.argv.slice(3));
} else if (command === "--help" || command === "-h" || command === "help") {
  console.log(HELP);
} else if (command === "--version" || command === "-v") {
  console.log(packageVersion());
} else if (command) {
  console.error(`Unknown command: ${command}\n\n${HELP}`);
  process.exitCode = 1;
} else {
  const { startServer } = await import("./server.js");
  await startServer();
}
