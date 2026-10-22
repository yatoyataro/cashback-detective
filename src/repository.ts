
import { pool } from "./db.js";
import type {
  Transaction,
  MerchantPolicy
} from "./data.js";

export async function findTransaction(
  transactionId: string
): Promise<Transaction | null> {
  const result = await pool.query(
    `SELECT
       id,
       user_id AS "userId",
       merchant_name AS merchant,
       amount,
       cashback_amount AS "cashbackAmount",
       days_since_purchase AS "daysSincePurchase",
       status
     FROM transactions
     WHERE id = $1`,
    [transactionId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  return {
    id: row.id,
    userId: row.userId,
    merchant: row.merchant,
    amount: Number(row.amount),
    cashbackAmount: Number(row.cashbackAmount),
    daysSincePurchase: row.daysSincePurchase,
    status: row.status
  };
}

export async function findMerchantPolicy(
  merchant: string
): Promise<MerchantPolicy | null> {
  const result = await pool.query(
    `SELECT
       merchant_name AS merchant,
       investigation_after_days AS "investigationAfterDays"
     FROM merchant_policies
     WHERE merchant_name = $1`,
    [merchant]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0] as MerchantPolicy;
}
