
import { pool } from "./db.js";
import type {
  Transaction,
  MerchantPolicy
} from "./data.js";

export type NewTransaction = Omit<Transaction, "id">;

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

export async function findAllTransactions(): Promise<Transaction[]> {
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
     ORDER BY id ASC`
  );

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    merchant: row.merchant,
    amount: Number(row.amount),
    cashbackAmount: Number(row.cashbackAmount),
    daysSincePurchase: row.daysSincePurchase,
    status: row.status
  }));
}

export async function createTransaction(
  transaction: NewTransaction
): Promise<Transaction> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Serialize ID generation so simultaneous requests don't select
    // the same next transaction ID.
    await client.query(
      "LOCK TABLE transactions IN EXCLUSIVE MODE"
    );

    const idResult = await client.query(
      `SELECT COALESCE(
         MAX(SUBSTRING(id FROM 4)::INTEGER),
         1000
       ) + 1 AS "nextId"
       FROM transactions
       WHERE id ~ '^TX-[0-9]+$'`
    );

    const transactionId =
      `TX-${String(idResult.rows[0].nextId).padStart(4, "0")}`;

    const result = await client.query(
      `INSERT INTO transactions (
         id,
         user_id,
         merchant_name,
         amount,
         cashback_amount,
         days_since_purchase,
         status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING
         id,
         user_id AS "userId",
         merchant_name AS merchant,
         amount,
         cashback_amount AS "cashbackAmount",
         days_since_purchase AS "daysSincePurchase",
         status`,
      [
        transactionId,
        transaction.userId,
        transaction.merchant,
        transaction.amount,
        transaction.cashbackAmount,
        transaction.daysSincePurchase,
        transaction.status
      ]
    );

    await client.query("COMMIT");

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
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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
