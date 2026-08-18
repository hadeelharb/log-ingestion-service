import { insertLogs } from "../database/logs.js";
import { getLogs, type QueryOptions } from "../database/queryLogs.js";
import { validateLog } from "../validators/logValidator.js";

export async function createLogs(logs: any[]) {
  const rejected: {
    index: number;
    reason: string;
  }[] = [];

  const validLogs = [];

  for (const [index, log] of logs.entries()) {
    const error = validateLog(log);

    if (error) {
      rejected.push({
        index,
        reason: error,
      });

      continue;
    }

    validLogs.push(log);
  }

  const accepted = validLogs.length;

  if (accepted > 0) {
    await insertLogs(validLogs);
  }

  return {
    accepted,
    rejected,
  };
}

export async function fetchLogs(filters: QueryOptions) {
  return getLogs(filters);
}
