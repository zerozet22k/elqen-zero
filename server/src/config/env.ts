import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  CLIENT_URL: z.string().default("http://localhost:3000"),
  MONGO_URL: z.string().default("mongodb://localhost:27017"),
  MONGO_DB: z.string().default("botDb"),
  PUBLIC_WEBHOOK_BASE_URL: z.string().default(""),
  GEMINI_API_KEY: z.string().default(""),
  GEMINI_MODEL: z.string().default("gemini-3.1-flash-lite-preview"),
  SOCKET_ORIGIN: z.string().default("http://localhost:3000"),
  JWT_SECRET: z.string().default("change-me"),
  SESSION_SECRET: z.string().default("change-me"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export const env = envSchema.parse(process.env);