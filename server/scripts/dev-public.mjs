import ngrok from "@ngrok/ngrok";
import { spawn } from "node:child_process";
import process from "node:process";
import fs from "node:fs";
import path from "node:path";

const SERVER_PORT = Number(process.env.PORT || 4000);

// Change this to your real backend dev command if needed.
const SERVER_START_CMD = process.env.SERVER_START_CMD || "npm run dev";

// Optional: set NGROK_DOMAIN if you have a reserved/static ngrok domain.
// Optional: set SERVER_CWD if this script is not run from the backend root.
const SERVER_CWD = process.env.SERVER_CWD || process.cwd();

function splitCommand(command) {
  return command.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((part) => {
    return part.replace(/^"|"$/g, "");
  }) || [];
}

let listener = null;
let child = null;

async function start() {
  listener = await ngrok.forward({
    addr: SERVER_PORT,
    authtoken_from_env: true,
    domain: process.env.NGROK_DOMAIN || undefined,
  });

  const publicUrl = listener.url();

  // Optional convenience file so you can inspect the current URL quickly.
  fs.writeFileSync(
    path.join(SERVER_CWD, ".ngrok-url"),
    `${publicUrl}\n`,
    "utf8"
  );

  console.log(`ngrok public URL: ${publicUrl}`);
  console.log(`PUBLIC_WEBHOOK_BASE_URL=${publicUrl}`);

  const childEnv = {
    ...process.env,
    PUBLIC_WEBHOOK_BASE_URL: publicUrl,
  };

  const [cmd, ...args] = splitCommand(SERVER_START_CMD);

  child = spawn(cmd, args, {
    cwd: SERVER_CWD,
    env: childEnv,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  child.on("exit", async (code, signal) => {
    await cleanup();
    process.exit(code ?? (signal ? 1 : 0));
  });
}

async function cleanup() {
  try {
    if (listener) {
      await listener.close();
      listener = null;
    }
  } catch {}

  try {
    if (child && !child.killed) {
      child.kill("SIGTERM");
    }
  } catch {}
}

process.on("SIGINT", async () => {
  await cleanup();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await cleanup();
  process.exit(0);
});

start().catch(async (error) => {
  console.error("Failed to start ngrok wrapper:");
  console.error(error);
  await cleanup();
  process.exit(1);
});