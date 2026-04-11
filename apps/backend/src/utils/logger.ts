const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

function formatMessage(level: LogLevel, message: string, meta?: unknown): string {
  const ts = new Date().toISOString();
  const metaStr = meta !== undefined ? ` ${JSON.stringify(meta)}` : "";
  return `[${ts}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

export const logger = {
  debug(message: string, meta?: unknown) {
    if (process.env.NODE_ENV !== "production") {
      console.debug(formatMessage("debug", message, meta));
    }
  },
  info(message: string, meta?: unknown) {
    console.info(formatMessage("info", message, meta));
  },
  warn(message: string, meta?: unknown) {
    console.warn(formatMessage("warn", message, meta));
  },
  error(message: string, meta?: unknown) {
    console.error(formatMessage("error", message, meta));
  },
};
