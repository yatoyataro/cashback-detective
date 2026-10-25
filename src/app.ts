
import express from "express";
import { z } from "zod";
import { investigateCashback } from "./cashback.js";

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

function answerGeneralQuestion(question: string): string {
  const normalized = question.toLowerCase();

  if (
    /\b(what is|what's|tell me about|who are you)\b/.test(normalized) &&
    /\b(cashback detective|you|your purpose)\b/.test(normalized)
  ) {
    return (
      "Cashback Detective is a demo assistant that checks fictional cashback transactions. " +
      "Provide a transaction ID, such as TX-1001, and I'll check its status, " +
      "apply the demo policy, and explain the next recommended action. " +
      "I can't verify real ShopBack accounts or official ShopBack policies."
    );
  }

  if (
    /\b(how do i|how can i|check|investigate|track|find)\b/.test(normalized) &&
    /\b(cashback|transaction|payment)\b/.test(normalized)
  ) {
    return (
      "To check your cashback in this demo, send a transaction ID such as TX-1001. " +
      "I'll look up the fictional transaction, check its status against the demo policy, " +
      "and explain the recommended next step."
    );
  }

  if (
    /\b(real|actual|my)\b/.test(normalized) &&
    /\b(shopback|account|transactions|transaction history)\b/.test(normalized) &&
    /\b(access|connect|login|log in|see|check|verify)\b/.test(normalized)
  ) {
    return (
      "No. This demo cannot log in to or access real ShopBack accounts or transaction history. " +
      "It can only check the fictional transactions available in its demo database."
    );
  }

  if (
    /\b(transaction id|transaction number|id do i need|which id)\b/.test(normalized)
  ) {
    return (
      "Provide a transaction ID in the format TX-1001. " +
      "The demo database includes examples such as TX-1001, TX-1002, TX-1003, and TX-1004."
    );
  }

  return SAFE_GENERAL_ANSWER;
}

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
    // Always check transaction IDs using deterministic business rules.
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
        investigation,
        answerSource: "rules_engine"
      });
    }

    return res.json({
      answer: answerGeneralQuestion(question),
      investigation: null,
      answerSource: "predefined"
    });
  } catch (error) {
    console.error("Request failed:", error);

    return res.status(500).json({
      error: "Unable to process your request right now."
    });
  }
});
