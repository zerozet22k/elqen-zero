import { createServer } from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { connectMongo } from "./lib/mongo";
import { logger } from "./lib/logger";
import { initializeRealtime } from "./lib/realtime";

const bootstrap = async () => {
  await connectMongo();
  const app = createApp();
  const server = createServer(app);
  initializeRealtime(server);
  server.listen(env.PORT, () => {
    logger.info("Server started", { port: env.PORT });
  });
};

bootstrap().catch((error) => {
  logger.error("Failed to start server", error);
  process.exit(1);
});
