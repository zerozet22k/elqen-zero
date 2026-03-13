import { spawn } from "node:child_process";
import process from "node:process";
import fs from "node:fs";
import path from "node:path";

const PORT = Number(process.env.PORT || 4000);
const SERVER_START_CMD = process.env.SERVER_START_CMD || "npm run dev";

let cloudflared;
let server;

function splitCommand(command) {
  return command.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((part) => {
    return part.replace(/^"|"$/g, "");
  }) || [];
}

function resolveCloudflaredCommand() {
  const explicit = process.env.CLOUDFLARED_PATH;
  if (explicit && fs.existsSync(explicit)) {
    return explicit;
  }

  const localExe = path.resolve(process.cwd(), "bin", "cloudflared.exe");
  if (fs.existsSync(localExe)) {
    return localExe;
  }

  return "cloudflared";
}

function startServer(publicUrl) {
  if (server) return;

  const [cmd, ...args] = splitCommand(SERVER_START_CMD);

  server = spawn(cmd, args, {
    env: {
      ...process.env,
      PORT: String(PORT),
      PUBLIC_WEBHOOK_BASE_URL: publicUrl,
    },
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  console.log(`\nPUBLIC_WEBHOOK_BASE_URL=${publicUrl}\n`);

  server.on("exit", (code) => {
    cleanup();
    process.exit(code ?? 0);
  });
}

function cleanup() {
  if (server && !server.killed) {
    server.kill("SIGTERM");
  }

  if (cloudflared && !cloudflared.killed) {
    cloudflared.kill("SIGTERM");
  }
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});

process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

const cloudflaredCmd = resolveCloudflaredCommand();

cloudflared = spawn(
  cloudflaredCmd,
  ["tunnel", "--url", `http://localhost:${PORT}`],
  {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  }
);

const handleOutput = (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);

  const match = text.match(/https:\/\/[-a-zA-Z0-9]+\.trycloudflare\.com/);
  if (match) {
    startServer(match[0]);
  }
};

cloudflared.stdout.on("data", handleOutput);
cloudflared.stderr.on("data", handleOutput);

cloudflared.on("error", (error) => {
  console.error(`Failed to start ${cloudflaredCmd}:`, error.message);
  process.exit(1);
});

cloudflared.on("exit", (code) => {
  if (!server) {
    console.error("cloudflared exited before a public URL was detected.");
  }
  cleanup();
  process.exit(code ?? 1);
});