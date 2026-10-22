
import { describe, it, expect } from "vitest";
import { investigateCashback } from "../src/cashback.js";

describe("Cashback investigation", () => {
  it("waits when a pending transaction is too recent", () => {
    const result = investigateCashback("TX-1001");

    expect(result?.decision).toBe("still_pending");
    expect(result?.evidence.daysSincePurchase).toBe(7);
  });

  it("allows investigation after the demo threshold", () => {
    const result = investigateCashback("TX-1002");

    expect(result?.decision).toBe("investigation_eligible");
  });

  it("rejects canceled transactions under the demo rules", () => {
    const result = investigateCashback("TX-1003");

    expect(result?.decision).toBe("ineligible");
  });

  it("recognizes cashback that has already been credited", () => {
    const result = investigateCashback("TX-1004");

    expect(result?.decision).toBe("already_credited");
  });

  it("does not invent a missing transaction", () => {
    const result = investigateCashback("TX-9999");

    expect(result).toBeNull();
  });
});
