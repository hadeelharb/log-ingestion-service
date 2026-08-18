export interface LogInput {
  timestamp: string;
  level: string;
  service: string;
  message: string;
  attributes?: Record<string, unknown>;
}

const allowedLevels = ["debug", "info", "warn", "error"];

export function validateLog(log: LogInput): string | null {
  // timestamp
  if (!log.timestamp) {
    return "timestamp is required";
  }

  const timestamp = new Date(log.timestamp);

  if (isNaN(timestamp.getTime())) {
    return "invalid timestamp";
  }

  const now = new Date();

  if (timestamp.getTime() > now.getTime() + 5 * 60 * 1000) {
    return "timestamp cannot be more than five minutes in the future";
  }

  // level
  if (!allowedLevels.includes(log.level)) {
    return `invalid level: '${log.level}'`;
  }

  // service
  if (typeof log.service !== "string" || log.service.trim() === "") {
    return "service is required";
  }

  // message
  if (typeof log.message !== "string" || log.message.trim() === "") {
    return "message is required";
  }

  // attributes
  if (log.attributes !== undefined) {
    if (typeof log.attributes !== "object" || Array.isArray(log.attributes)) {
      return "attributes must be an object";
    }

    for (const value of Object.values(log.attributes)) {
      if (typeof value === "object" && value !== null) {
        return "nested attributes are not allowed";
      }
    }
  }

  return null;
}
