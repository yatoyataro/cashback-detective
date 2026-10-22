
import express from "express";
import { z } from "zod";
import { investigateCashback } from "./cashback.js";

export const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "Cashback Detective"
  });
});

app.get("/investigate/:transactionId", (req, res) => {
  const parsed = z.string()
    .regex(/^TX-\d{4}$/)
    .safeParse(req.params.transactionId);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid transaction ID format. Use TX-1001."
    });
  }

  const result = investigateCashback(parsed.data);

  if (!result) {
    return res.status(404).json({
      error: "Transaction not found."
    });
  }

  return res.json(result);
});
