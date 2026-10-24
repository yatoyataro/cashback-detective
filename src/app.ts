
import express from "express";
import { z } from "zod";
import { investigateCashback } from "./cashback.js";
import { askCashbackAgent } from "./agent.js";

export const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "Cashback Detective"
  });
});

app.get("/investigate/:transactionId", async (req, res) => {
  const parsed = z.string()
    .regex(/^TX-\d{4}$/)
    .safeParse(req.params.transactionId);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid transaction ID format. Use TX-1001."
    });
  }

  try {
    const result = await investigateCashback(parsed.data);

    if (!result) {
      return res.status(404).json({
        error: "Transaction not found."
      });
    }

    return res.json(result);
  } catch (error) {
    console.error("Investigation failed:", error);

    return res.status(500).json({
      error: "Unable to investigate the transaction right now."
    });
  }
});


app.post("/ask", async (req, res) => {
  const schema = z.object({
    question: z.string().trim().min(1).max(1000)
  });

  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Provide a question between 1 and 1000 characters."
    });
  }


  try {
    const question = parsed.data.question;

    const transactionId = question.match(/\bTX-\d{4}\b/i)?.[0];

    if (transactionId) {
      const investigation = await investigateCashback(
        transactionId.toUpperCase()
      );

      if (!investigation) {
        return res.status(404).json({
          error: "Transaction not found.",
          transactionId: transactionId.toUpperCase()
        });
      }

      return res.json({
        answer: [
          investigation.message,
          `Decision: ${investigation.decision}.`,
          `Next action: ${investigation.nextAction}`
        ].join("\n\n"),
        investigation
      });
    }

    const answer = await askCashbackAgent(question);

    return res.json({
      answer,
      investigation: null
    });
  } catch (error) {
    console.error("AI investigation failed:", error);

    return res.status(502).json({
      error: "The AI investigation service is temporarily unavailable."
    });
  }
});

