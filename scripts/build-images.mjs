import path from "node:path";
import { ensureDockerAvailable, repoRoot, runDocker } from "./docker-utils.mjs";

const imageConfigs = {
  client: {
    context: path.join(repoRoot, "client"),
    dockerfile: path.join(repoRoot, "client", "Dockerfile"),
    tag: process.env.CLIENT_IMAGE_TAG || "elqen-zero-client-local",
  },
  server: {
    context: path.join(repoRoot, "server"),
    dockerfile: path.join(repoRoot, "server", "Dockerfile"),
    tag: process.env.SERVER_IMAGE_TAG || "elqen-zero-server-local",
  },
};

const requestedTargets = process.argv.slice(2);
const targets =
  requestedTargets.length > 0
    ? requestedTargets
    : ["server", "client"];

const invalidTargets = targets.filter((target) => !(target in imageConfigs));
if (invalidTargets.length > 0) {
  console.error(
    `Unknown image target(s): ${invalidTargets.join(", ")}. Use client and/or server.`
  );
  process.exit(1);
}

const buildTarget = async (target) => {
  const config = imageConfigs[target];
  console.log(`\n==> Building ${target} image as ${config.tag}`);
  await runDocker([
    "build",
    "-f",
    config.dockerfile,
    "-t",
    config.tag,
    config.context,
  ]);
};

const main = async () => {
  await ensureDockerAvailable("Install Docker Desktop, then rerun `npm run docker:build`.");

  for (const target of targets) {
    await buildTarget(target);
  }

  console.log("\nBuild completed.");
  for (const target of targets) {
    const config = imageConfigs[target];
    console.log(`- ${target}: ${config.tag}`);
  }
};

main().catch((error) => {
  console.error(`\nDocker image build failed: ${error.message}`);
  process.exit(1);
});
