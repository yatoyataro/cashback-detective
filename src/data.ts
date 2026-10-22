
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

export const transactions: Transaction[] = [
  {
    id: "TX-1001",
    userId: "USER-1",
    merchant: "Demo Store",
    amount: 3000,
    cashbackAmount: 150,
    daysSincePurchase: 7,
    status: "pending"
  },
  {
    id: "TX-1002",
    userId: "USER-1",
    merchant: "Demo Store",
    amount: 2000,
    cashbackAmount: 100,
    daysSincePurchase: 20,
    status: "pending"
  },
  {
    id: "TX-1003",
    userId: "USER-1",
    merchant: "Demo Store",
    amount: 1500,
    cashbackAmount: 75,
    daysSincePurchase: 5,
    status: "canceled"
  },
  {
    id: "TX-1004",
    userId: "USER-2",
    merchant: "Demo Store",
    amount: 5000,
    cashbackAmount: 250,
    daysSincePurchase: 30,
    status: "credited"
  }
];

export const merchantPolicies: MerchantPolicy[] = [
  {
    merchant: "Demo Store",
    investigationAfterDays: 14
  }
];
