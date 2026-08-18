import { db } from "./index.js";
import { logs } from "./schema.js";

export interface InsertLogInput {
  timestamp: string;
  level: string;
  service: string;
  message: string;
  attributes?: Record<string, unknown>;
}

export async function insertLogs(logEntries: InsertLogInput[]) {
  if (logEntries.length === 0) {
    return;
  }

  await db.insert(logs).values(
    logEntries.map((log) => ({
      timestamp: new Date(log.timestamp),
      level: log.level,
      service: log.service,
      message: log.message,
      attributes: log.attributes ?? {},
    })),
  );
}

export async function insertLog(logEntry: InsertLogInput) {
  await insertLogs([logEntry]);
}
