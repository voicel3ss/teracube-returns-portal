import "dotenv/config";

const required = ["DATABASE_URL", "AUTH_TOKEN_SECRET", "PII_ENCRYPTION_KEY", "WEBHOOK_SIGNING_SECRET", "AUTOMATION_JOB_SECRET", "POSTMARK_SERVER_TOKEN", "GOOGLE_ADDRESS_VALIDATION_API_KEY", "SHOPIFY_ADMIN_ACCESS_TOKEN", "SHOPIFY_WEBHOOK_SECRET", "SHIPSAVING_API_KEY", "FRESHDESK_API_KEY", "THRIVE_API_BASE_URL", "THRIVE_API_TOKEN", "GIGS_API_TOKEN", "OBJECT_STORAGE_BUCKET", "OBJECT_STORAGE_ACCESS_KEY_ID", "OBJECT_STORAGE_SECRET_ACCESS_KEY"] as const;
const unsafe = /replace-with|change-before-production|teracube_dev|^local-/i;
const missing = required.filter((name) => !process.env[name]?.trim() || unsafe.test(process.env[name] ?? ""));
if (missing.length) { console.error(`Production configuration is incomplete: ${missing.join(", ")}`); process.exitCode = 1; }
else console.log("Production configuration check passed.");
