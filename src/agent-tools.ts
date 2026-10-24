
import { findTransaction } from "./repository.js";
import { investigateCashback } from "./cashback.js";

export async function runAgentTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const transactionId = args.transactionId;

  if (
    typeof transactionId !== "string" ||
    !/^TX-\d{4}$/.test(transactionId)
  ) {
    return {
      error: "A valid transaction ID is required."
    };
  }

  switch (name) {
    case "get_transaction_details": {
      const transaction = await findTransaction(transactionId);

      if (!transaction) {
        return {
          error: "Transaction not found."
        };
      }

      // Return only the information needed for the investigation.
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
        error: "Transaction not found."
      };
    }

    default:
      return {
        error: `Unknown tool: ${name}`
      };
  }
}
