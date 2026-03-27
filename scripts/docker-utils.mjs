import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const repoRoot = path.resolve(__dirname, "..");

export const resolveDockerCommand = () => {
  const override = process.env.DOCKER_BIN?.trim();
  if (override) {
    return override;
  }

  if (process.platform === "win32") {
    const candidates = [
      "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
      "C:\\Program Files\\Docker\\Docker\\resources\\docker.exe",
      "docker",
    ];

    for (const candidate of candidates) {
      if (candidate !== "docker" && fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return "docker";
  }

  return "docker";
};

export const dockerCommand = resolveDockerCommand();
const dockerBinDir =
  dockerCommand === "docker" ? null : path.dirname(dockerCommand);

export const buildDockerEnv = (env = {}) => ({
  ...process.env,
  ...env,
  PATH: dockerBinDir
    ? `${dockerBinDir}${path.delimiter}${process.env.PATH || ""}`
    : process.env.PATH,
});

export const runCommand = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
      shell: false,
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });

export const runDocker = (args, options = {}) =>
  runCommand(dockerCommand, args, {
    ...options,
    env: buildDockerEnv(options.env),
  });

export const ensureDockerAvailable = async (retryHint) => {
  try {
    await runDocker(["version"]);
  } catch (error) {
    console.error("Docker CLI is not available on this machine.");
    if (retryHint) {
      console.error(retryHint);
    }
    throw error;
  }
};
