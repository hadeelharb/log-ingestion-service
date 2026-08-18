import "dotenv/config";

import app from "./server.js";
import { db, checkDatabaseConnection } from "./database/index.js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { deleteExpiredLogs } from "./services/retentionService.js";

const PORT = Number(process.env.PORT) || 8080;
const RETENTION_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function runRetention() {
  try {
    const deleted = await deleteExpiredLogs();

    if (deleted > 0) {
      console.log(`Retention deleted ${deleted} expired logs.`);
    }
  } catch (error) {
    console.error("Automatic retention failed:", error);
  }
}

async function start() {
  try {
    console.log("Running database migrations...");

    await migrate(db, {
      migrationsFolder: "./src/database/migrations",
    });

    console.log("Database migrations completed.");

    await checkDatabaseConnection();

    await runRetention();

    setInterval(runRetention, RETENTION_INTERVAL_MS);

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start application:", error);

    process.exit(1);
  }
}

start();
