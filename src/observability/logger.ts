const sensitiveKeys = /email|phone|iccid|address|token|secret|password|code|payment/i;

export function redactForLog(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactForLog);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sensitiveKeys.test(key) ? "[REDACTED]" : redactForLog(item)]));
  return value;
}

export function logEvent(level: "info" | "warn" | "error", event: string, context: Record<string, unknown> = {}) {
  const safeContext = redactForLog(context) as Record<string, unknown>;
  const record = JSON.stringify({ level, event, time: new Date().toISOString(), ...safeContext });
  if (level === "error") console.error(record); else if (level === "warn") console.warn(record); else console.info(record);
}
