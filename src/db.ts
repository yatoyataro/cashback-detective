
import "dotenv/config";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing from .env");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error.message);
});

export async function checkDatabaseConnection(): Promise<void> {
  const result = await pool.query("SELECT NOW() AS current_time");
  console.log("Connected to PostgreSQL:", result.rows[0].current_time);
}
