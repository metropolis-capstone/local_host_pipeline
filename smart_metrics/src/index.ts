import express from "express";
import { pool } from "./database.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.get("/api/recommendations", async (_req, res) => {
  const result = await pool.query(
    `SELECT * FROM recommendations WHERE status = 'pending' ORDER BY created_at DESC`
  );
  res.json(result.rows);
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
