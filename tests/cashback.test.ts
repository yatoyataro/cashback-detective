
import { afterAll, describe, it, expect } from "vitest";
import { investigateCashback } from "../src/cashback.js";
import { pool } from "../src/db.js";

afterAll(async () => {
  await pool.end();
});

describe("Cashback investigation with PostgreSQL", () => {
  it("waits when a transaction is too recent", async () => {
    const result = await investigateCashback("TX-1001");

    expect(result?.decision).toBe("still_pending");
    expect(result?.evidence.daysSincePurchase).toBe(7);
  });

  it("allows investigation after the demo threshold", async () => {
    const result = await investigateCashback("TX-1002");

    expect(result?.decision).toBe("investigation_eligible");
  });

  it("rejects a canceled transaction under the demo rules", async () => {
    const result = await investigateCashback("TX-1003");

    expect(result?.decision).toBe("ineligible");
  });

  it("recognizes already credited cashback", async () => {
    const result = await investigateCashback("TX-1004");

    expect(result?.decision).toBe("already_credited");
  });

  it("returns null for a missing transaction", async () => {
    const result = await investigateCashback("TX-9999");

    expect(result).toBeNull();
  });
});
