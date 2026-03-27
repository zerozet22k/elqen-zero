import { copyFileSync, existsSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), "server", ".env");
const envExamplePath = resolve(process.cwd(), "server", ".env.example");

if (existsSync(envPath)) {
  console.log("[ensure:env] server/.env already exists");
  process.exit(0);
}

if (!existsSync(envExamplePath)) {
  console.error("[ensure:env] Missing server/.env.example");
  process.exit(1);
}

copyFileSync(envExamplePath, envPath);
console.log("[ensure:env] Created server/.env from server/.env.example");
