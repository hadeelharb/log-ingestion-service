import { Router } from "express";

import { validateLog } from "../validators/logValidator.js";
import { insertLogs } from "../database/logs.js";
import { getLogs } from "../database/queryLogs.js";

import { decodeCursor, encodeCursor } from "../utils/cursor.js";

const router = Router();

const allowedLevels = new Set(["debug", "info", "warn", "error"]);

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

router.get("/", async (req, res) => {
  try {
    const service =
      typeof req.query.service === "string" ? req.query.service : undefined;

    const level =
      typeof req.query.level === "string" ? req.query.level : undefined;

    const since =
      typeof req.query.since === "string"
        ? new Date(req.query.since)
        : undefined;

    const until =
      typeof req.query.until === "string"
        ? new Date(req.query.until)
        : undefined;

    const q = typeof req.query.q === "string" ? req.query.q : undefined;

    const limit =
      req.query.limit === undefined ? DEFAULT_LIMIT : Number(req.query.limit);

    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;

    if (level !== undefined && !allowedLevels.has(level)) {
      return res.status(400).json({
        error: `invalid level: '${level}'`,
      });
    }

    if (since && Number.isNaN(since.getTime())) {
      return res.status(400).json({
        error: "Invalid 'since' timestamp",
      });
    }

    if (until && Number.isNaN(until.getTime())) {
      return res.status(400).json({
        error: "Invalid 'until' timestamp",
      });
    }

    if (since && until && until < since) {
      return res.status(400).json({
        error: "'until' cannot be earlier than 'since'",
      });
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      return res.status(400).json({
        error: `limit must be an integer between 1 and ${MAX_LIMIT}`,
      });
    }

    let decodedCursor;

    if (cursor) {
      try {
        decodedCursor = decodeCursor(cursor);
      } catch {
        return res.status(400).json({
          error: "Invalid cursor",
        });
      }
    }

    const attributes: Record<string, string> = {};

    for (const [key, value] of Object.entries(req.query)) {
      if (!key.startsWith("attr.")) {
        continue;
      }

      if (typeof value !== "string") {
        return res.status(400).json({
          error: `Invalid attribute filter: ${key}`,
        });
      }

      const attributeKey = key.slice(5);

      if (!attributeKey) {
        return res.status(400).json({
          error: "Attribute key cannot be empty",
        });
      }

      attributes[attributeKey] = value;
    }

    const rows = await getLogs({
      service,
      level,
      since,
      until,
      q,
      attributes,
      limit,
      cursor: decodedCursor,
    });

    const hasMore = rows.length > limit;

    const resultLogs = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;

    if (hasMore) {
      const lastLog = resultLogs[resultLogs.length - 1];

      nextCursor = encodeCursor({
        timestamp: lastLog.timestamp.toISOString(),
        id: lastLog.id,
      });
    }

    return res.json({
      logs: resultLogs,
      next_cursor: nextCursor,
    });
  } catch (error) {
    console.error("Failed to fetch logs:", error);

    return res.status(500).json({
      error: "Failed to fetch logs",
    });
  }
});

router.post("/", async (req, res) => {
  const body = req.body;

  if (!body || !Array.isArray(body.logs)) {
    return res.status(400).json({
      error: "Request must contain a logs array",
    });
  }

  let accepted = 0;

  const rejected: {
    index: number;
    reason: string;
  }[] = [];

  const validLogs = [];

  for (const [index, log] of body.logs.entries()) {
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

  accepted = validLogs.length;

  if (accepted > 0) {
    try {
      await insertLogs(validLogs);
    } catch (error) {
      console.error("Failed to insert logs:", error);

      return res.status(500).json({
        error: "Failed to store logs",
      });
    }
  }

  if (accepted === 0) {
    return res.status(400).json({
      accepted,
      rejected,
    });
  }

  return res.json({
    accepted,
    rejected,
  });
});

export default router;
