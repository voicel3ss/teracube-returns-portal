import { z } from "zod";

const serverEnvironmentSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  AUTH_TOKEN_SECRET: z.string().min(32),
  PII_ENCRYPTION_KEY: z.string().optional(),
  WEBHOOK_SIGNING_SECRET: z.string().min(32).optional(),
  AUTOMATION_JOB_SECRET: z.string().min(32).optional(),
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function readServerEnvironment(environment: NodeJS.ProcessEnv = process.env): ServerEnvironment {
  return serverEnvironmentSchema.parse(environment);
}
