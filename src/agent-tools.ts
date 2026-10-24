
import { z } from "zod";
import { findTransaction } from "./repository.js";
import { investigateCashback } from "./cashback.js";

const transactionArgumentsSchema = z.object({
  transactionId: z.string().regex(
    /^TX-\d{4}$/,
    "Transaction ID must look like TX-1001."
  )
}).strict();

const allowedTools = [
  "get_transaction_details",
  "investigate_cashback"
] as const;

export async function runAgentTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  if (!allowedTools.includes(name as typeof allowedTools[number])) {
    return {
      error: "Unknown tool. No action was performed."
    };
  }

  const parsedArgs = transactionArgumentsSchema.safeParse(args);

  if (!parsedArgs.success) {
    return {
      error: "Invalid tool arguments. Provide a transaction ID such as TX-1001."
    };
  }

  const { transactionId } = parsedArgs.data;

  try {
    switch (name) {
      case "get_transaction_details": {
        const transaction = await findTransaction(transactionId);

        if (!transaction) {
          return {
            error: "Transaction not found.",
            transactionId
          };
        }

        return {
          id: transaction.id,
          merchant: transaction.merchant,
          amount: transaction.amount,
          cashbackAmount: transaction.cashbackAmount,
          daysSincePurchase: transaction.daysSincePurchase,
          status: transaction.status
        };
      }

      case "investigate_cashback": {
        const result = await investigateCashback(transactionId);

        return result ?? {
          error: "Transaction not found.",
          transactionId
        };
      }
    }
  } catch (error) {
    console.error(`Agent tool "${name}" failed:`, error);

    return {
      error: "The tool could not complete the request. No result was verified."
    };
  }
}
