import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not defined");
}

console.log("DATABASE_URL =", databaseUrl);

export const client = postgres(databaseUrl, {
  max: 12,
});

export const db = drizzle(client);

export async function checkDatabaseConnection() {
  await client`SELECT 1`;
}
