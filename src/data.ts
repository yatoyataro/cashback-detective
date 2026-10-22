
export type TransactionStatus =
  | "pending"
  | "canceled"
  | "returned"
  | "credited";

export interface Transaction {
  id: string;
  userId: string;
  merchant: string;
  amount: number;
  cashbackAmount: number;
  daysSincePurchase: number;
  status: TransactionStatus;
}

export interface MerchantPolicy {
  merchant: string;
  investigationAfterDays: number;
}
