import express from "express";
import logsRouter from "./routes/logs.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { logger } from "./middleware/logger.js";
import { checkDatabaseConnection } from "./database/index.js";
import aggregateRouter from "./routes/aggregate.js";
import { deleteExpiredLogs } from "./services/retentionService.js";

const app = express();

app.use(
  express.json({
    limit: "2mb",
  }),
);

app.use(logger);

app.use("/logs/aggregate", aggregateRouter);

app.use("/logs", logsRouter);

app.get("/health", async (_, res) => {
  try {
    await checkDatabaseConnection();

    return res.status(200).json({
      status: "ok",
      service: "log-ingestion-service",
    });
  } catch {
    return res.status(503).json({
      status: "unhealthy",
    });
  }
});

app.post("/admin/retention/run", async (_, res) => {
  try {
    const deleted = await deleteExpiredLogs();

    return res.status(200).json({
      deleted,
    });
  } catch (error) {
    console.error("Retention failed:", error);

    return res.status(500).json({
      error: "Retention failed",
    });
  }
});

app.use(errorHandler);

export default app;