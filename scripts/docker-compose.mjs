import { ensureDockerAvailable, runDocker } from "./docker-utils.mjs";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("No docker compose arguments provided.");
  console.error("Example: node scripts/docker-compose.mjs up -d");
  process.exit(1);
}

const main = async () => {
  await ensureDockerAvailable(
    "Start Docker Desktop or open a fresh terminal, then rerun the compose command."
  );

  await runDocker(["compose", "-f", "compose.yaml", ...args]);
};

main().catch((error) => {
  console.error(`\nDocker compose command failed: ${error.message}`);
  process.exit(1);
});
