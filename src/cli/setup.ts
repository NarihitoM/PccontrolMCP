import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { PACKAGE_NAME, packageVersion } from "../lib/package.js";
import { stopBridge } from "../lib/powershell.js";
import { formatInfo, systemInfo } from "../services/system.js";
import { type Client, CLIENTS, currentEnv, detectClients, SERVER_NAME } from "../setup/clients.js";
import { type ServerLaunch, serverLaunch } from "../setup/launch.js";
import { Prompt } from "./prompt.js";

interface SetupOptions {
  yes: boolean;
  clients?: string;
}

function parseOptions(argv: string[]): SetupOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      yes: { type: "boolean", short: "y", default: false },
      clients: { type: "string" },
    },
    allowPositionals: false,
  });
  return { yes: values.yes, clients: values.clients };
}

function heading(step: string, title: string): void {
  console.log(`\n[${step}] ${title}`);
}

async function checkPc(): Promise<void> {
  heading("1/2", "Check this PC");
  if (process.platform !== "win32") throw new Error("pc-mcp only supports Windows.");
  try {
    const info = await systemInfo();
    console.log(formatInfo(info).replace(/^/gm, "  "));
  } finally {
    stopBridge();
  }
}

function requestedClients(list: string | undefined): Client[] {
  if (!list) return CLIENTS;
  const ids = list.split(",").map((id) => id.trim().toLowerCase()).filter(Boolean);
  const unknown = ids.filter((id) => !CLIENTS.some((client) => client.id === id));
  if (unknown.length > 0) {
    throw new Error(`Unknown --clients: ${unknown.join(", ")}. Use: ${CLIENTS.map((client) => client.id).join(", ")}`);
  }
  return CLIENTS.filter((client) => ids.includes(client.id));
}

function manualConfig(launch: ServerLaunch): string {
  return JSON.stringify({ mcpServers: { [SERVER_NAME]: { command: launch.command, args: launch.args } } }, null, 2);
}

async function chooseClients(prompt: Prompt, found: Client[], options: SetupOptions): Promise<Client[]> {
  if (options.yes || options.clients) return found;
  if (await prompt.confirm("  Add the pc server to all of these?")) return found;

  const chosen: Client[] = [];
  for (const client of found) {
    if (await prompt.confirm(`  Add to ${client.name}?`, false)) chosen.push(client);
  }
  return chosen;
}

async function configureClients(prompt: Prompt, options: SetupOptions): Promise<void> {
  heading("2/2", "Add the pc server to your AI tools");
  const env = currentEnv();
  const scriptPath = fileURLToPath(new URL("../index.js", import.meta.url));
  const launch = serverLaunch(scriptPath, process.execPath, env.platform, packageVersion());

  const found = await detectClients(env, requestedClients(options.clients));
  if (found.length === 0) {
    console.log("  No supported AI tools found. Add this to your MCP client config:\n");
    console.log(manualConfig(launch));
    return;
  }

  console.log(`  Found: ${found.map((client) => client.name).join(", ")}`);
  const chosen = await chooseClients(prompt, found, options);

  for (const client of chosen) {
    try {
      console.log(`  [ok]   ${client.name}: ${await client.install(launch, env)}`);
    } catch (error) {
      console.log(`  [fail] ${client.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  for (const client of found.filter((client) => !chosen.includes(client))) {
    console.log(`  [skip] ${client.name}`);
  }
}

export async function runSetupCommand(argv: string[]): Promise<void> {
  const prompt = new Prompt();

  try {
    const options = parseOptions(argv);
    console.log(`PC MCP setup (${PACKAGE_NAME} ${packageVersion()})`);
    await checkPc();
    await configureClients(prompt, options);

    console.log("\nAll set. Restart your AI tool (or open a new chat) so it loads the pc tools.");
    console.log('Then try: "what windows are open on my PC?"');
  } catch (error) {
    console.error(`\nSetup stopped: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    prompt.close();
  }
}
