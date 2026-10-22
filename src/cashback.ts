
import {
  transactions,
  merchantPolicies,
  type Transaction
} from "./data.js";

export type InvestigationResult = {
  transactionId: string;
  status: string;
  decision: string;
  message: string;
  nextAction: string;
  evidence: {
    purchaseAmount: number;
    expectedCashback: number;
    daysSincePurchase: number;
    investigationAfterDays: number | null;
  };
};

export function investigateCashback(
  transactionId: string
): InvestigationResult | null {
  const transaction = transactions.find(
    (item) => item.id === transactionId
  );

  // The transaction does not exist.
  if (!transaction) {
    return null;
  }

  const policy = merchantPolicies.find(
    (item) => item.merchant === transaction.merchant
  );

  const threshold = policy?.investigationAfterDays ?? null;

  let decision: string;
  let message: string;
  let nextAction: string;

  if (
    transaction.status === "canceled" ||
    transaction.status === "returned"
  ) {
    decision = "ineligible";
    message =
      "The transaction was canceled or returned. Under this demo policy, it is not eligible for cashback.";
    nextAction =
      "Review the transaction details and the applicable merchant policy.";
  } else if (transaction.status === "credited") {
    decision = "already_credited";
    message = "This transaction's cashback has already been credited.";
    nextAction = "Check the rewards balance for the credited cashback.";
  } else if (threshold === null) {
    decision = "policy_unavailable";
    message =
      "The merchant's investigation policy is unavailable. A reliable decision cannot be made.";
    nextAction =
      "Check the merchant policy before deciding whether to investigate.";
  } else if (transaction.daysSincePurchase < threshold) {
    decision = "still_pending";
    message =
      `The transaction is ${transaction.daysSincePurchase} days old. ` +
      `The demo investigation threshold is ${threshold} days.`;
    nextAction =
      "Wait until the investigation threshold is reached, then check again.";
  } else {
    decision = "investigation_eligible";
    message =
      `The transaction has been pending for ${transaction.daysSincePurchase} days, ` +
      `which meets the demo threshold of ${threshold} days.`;
    nextAction =
      "Prepare a missing-cashback investigation for review.";
  }

  return {
    transactionId: transaction.id,
    status: transaction.status,
    decision,
    message,
    nextAction,
    evidence: {
      purchaseAmount: transaction.amount,
      expectedCashback: transaction.cashbackAmount,
      daysSincePurchase: transaction.daysSincePurchase,
      investigationAfterDays: threshold
    }
  };
}
