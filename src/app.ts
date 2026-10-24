
import express from "express";
import { z } from "zod";
import { investigateCashback } from "./cashback.js";
import { askCashbackAgent } from "./agent.js";

export const app = express();

app.use(express.json());

const generalQuestionSchema = z.object({
  question: z.string().trim().min(1).max(1000)
});

const SAFE_GENERAL_ANSWER =
  "I'm Cashback Detective, a demo assistant that checks fictional cashback transactions. " +
  "Provide a transaction ID, such as TX-1001, and I'll check its status, " +
  "apply the demo policy, and explain the next recommended action. " +
  "I can't verify real ShopBack accounts or official ShopBack policies.";

// AI responses are opt-in and disabled during automated tests.
const ENABLE_AI_GENERAL_QUESTIONS =
  process.env.ENABLE_AI_GENERAL_QUESTIONS === "true" &&
  process.env.NODE_ENV !== "test";

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
  const parsed = generalQuestionSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Provide a question between 1 and 1000 characters."
    });
  }

  const question = parsed.data.question;

  try {
    // Detect transaction IDs before using the AI.
    // Transaction decisions always come from the rules engine.
    const transactionId = question.match(/\bTX-\d{4}\b/i)?.[0];

    if (transactionId) {
      const normalizedId = transactionId.toUpperCase();
      const investigation =
        await investigateCashback(normalizedId);

      if (!investigation) {
        return res.status(404).json({
          error: "Transaction not found.",
          transactionId: normalizedId
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

    // General questions can use the local AI when explicitly enabled.
    if (ENABLE_AI_GENERAL_QUESTIONS) {
      try {
        const answer = await askCashbackAgent(question);

        return res.json({
          answer,
          investigation: null,
          answerSource: "local_ai"
        });
      } catch (error) {
        // An AI failure should not make the API unavailable.
        console.error(
          "Local AI failed; using the safe fallback:",
          error
        );
      }
    }

    // Keep the default response deterministic and testable.
    return res.json({
      answer: SAFE_GENERAL_ANSWER,
      investigation: null,
      answerSource: "fallback"
    });
  } catch (error) {
    console.error("Request failed:", error);

    return res.status(500).json({
      error: "Unable to process your request right now."
    });
  }
});
