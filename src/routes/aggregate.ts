import { Router } from "express";

import {
  aggregateLogs,
  type AggregateBucket,
  type AggregateGroupBy,
} from "../database/aggregateLogs.js";

const router = Router();

const allowedLevels = new Set([
  "debug",
  "info",
  "warn",
  "error",
]);

const allowedBuckets = new Set([
  "1m",
  "5m",
  "1h",
  "1d",
]);

const allowedGroups = new Set([
  "service",
  "level",
]);

router.get("/", async (req, res) => {
  try {
    const since =
      typeof req.query.since === "string"
        ? new Date(req.query.since)
        : undefined;

    const until =
      typeof req.query.until === "string"
        ? new Date(req.query.until)
        : undefined;

    const bucket =
      typeof req.query.bucket === "string"
        ? req.query.bucket
        : undefined;

    const groupBy =
      typeof req.query.group_by === "string"
        ? req.query.group_by
        : undefined;

    const service =
      typeof req.query.service === "string"
        ? req.query.service
        : undefined;

    const level =
      typeof req.query.level === "string"
        ? req.query.level
        : undefined;

    const q =
      typeof req.query.q === "string"
        ? req.query.q
        : undefined;

    if (!since) {
      return res.status(400).json({
        error: "since is required",
      });
    }

    if (Number.isNaN(since.getTime())) {
      return res.status(400).json({
        error: "Invalid 'since' timestamp",
      });
    }

    if (!until) {
      return res.status(400).json({
        error: "until is required",
      });
    }

    if (Number.isNaN(until.getTime())) {
      return res.status(400).json({
        error: "Invalid 'until' timestamp",
      });
    }

    if (until < since) {
      return res.status(400).json({
        error: "'until' cannot be earlier than 'since'",
      });
    }

    if (
      !bucket ||
      !allowedBuckets.has(bucket)
    ) {
      return res.status(400).json({
        error: "bucket must be one of: 1m, 5m, 1h, 1d",
      });
    }

    if (
      groupBy !== undefined &&
      !allowedGroups.has(groupBy)
    ) {
      return res.status(400).json({
        error:
          "group_by must be either 'service' or 'level'",
      });
    }

    if (
      level !== undefined &&
      !allowedLevels.has(level)
    ) {
      return res.status(400).json({
        error: `invalid level: '${level}'`,
      });
    }

    const attributes: Record<string, string> = {};

    for (const [key, value] of Object.entries(
      req.query,
    )) {
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

    const buckets = await aggregateLogs({
      since,
      until,
      bucket: bucket as AggregateBucket,
      groupBy:
        groupBy as AggregateGroupBy | undefined,
      service,
      level,
      q,
      attributes,
    });

    return res.status(200).json({
      buckets,
    });
  } catch (error) {
    console.error(
      "Failed to aggregate logs:",
      error,
    );

    return res.status(500).json({
      error: "Failed to aggregate logs",
    });
  }
});

export default router;