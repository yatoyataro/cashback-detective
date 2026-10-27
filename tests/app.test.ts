
import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { pool } from "../src/db.js";

afterAll(async () => {
  await pool.end();
});

describe("Cashback Detective API", () => {
  it("returns a healthy status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.service).toBe("Cashback Detective");
  });

  it("returns the correct investigation for an eligible transaction", async () => {
    const response = await request(app)
      .post("/ask")
      .send({
        question: "Investigate cashback for TX-1002."
      });

    expect(response.status).toBe(200);
    expect(response.body.investigation.transactionId).toBe("TX-1002");
    expect(response.body.investigation.decision).toBe(
      "investigation_eligible"
    );
    expect(response.body.investigation.nextAction).toBe(
      "Prepare a missing-cashback investigation for review."
    );
  });

  it("returns 404 for a nonexistent transaction", async () => {
    const response = await request(app)
      .post("/ask")
      .send({
        question: "Investigate cashback for TX-9999."
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Transaction not found.");
  });

  it("rejects an empty question", async () => {
    const response = await request(app)
      .post("/ask")
      .send({ question: "   " });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Provide a question between 1 and 1000 characters."
    );
  });

  it("rejects a malformed transaction ID", async () => {
    const response = await request(app)
      .get("/investigate/TX-12");

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Invalid transaction ID format. Use TX-1001."
    );
  });

  it("returns a safe explanation for a general question", async () => {
    const response = await request(app)
      .post("/ask")
      .send({
        question: "What is Cashback Detective, and how can it help me?"
      });

    expect(response.status).toBe(200);
    expect(response.body.answer).toContain("demo assistant");
    expect(response.body.answer).toContain("TX-1001");
    expect(response.body.answer).toContain(
      "I can't verify real ShopBack accounts"
    );
    expect(response.body.investigation).toBeNull();
  });
  
  it("lists transactions", async () => {
    const response = await request(app).get("/transactions");

    expect(response.status).toBe(200);
    expect(response.body.count).toBeGreaterThanOrEqual(4);
    expect(response.body.transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "TX-1001",
          merchant: "Demo Store"
        })
      ])
    );
  });

  it("creates a demo transaction and returns its investigation", async () => {
    const response = await request(app)
      .post("/transactions")
      .send({
        userId: "USER-1",
        merchant: "Demo Store",
        amount: 1200,
        cashbackAmount: 60,
        daysSincePurchase: 20,
        status: "pending"
      });

    expect(response.status).toBe(201);
    expect(response.body.transaction.id).toMatch(/^TX-\d+$/);
    expect(response.body.transaction.merchant).toBe("Demo Store");
    expect(response.body.investigation.decision).toBe(
      "investigation_eligible"
    );

    // Remove the test record so repeated test runs don't accumulate data.
    await pool.query(
      "DELETE FROM transactions WHERE id = $1",
      [response.body.transaction.id]
    );
  });

  it("rejects invalid transaction data", async () => {
    const response = await request(app)
      .post("/transactions")
      .send({
        userId: "USER-1",
        merchant: "Demo Store",
        amount: -100,
        cashbackAmount: 10,
        daysSincePurchase: 5,
        status: "pending"
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid transaction data.");
  });

  it("rejects a transaction for an unknown merchant", async () => {
    const response = await request(app)
      .post("/transactions")
      .send({
        userId: "USER-1",
        merchant: "Unknown Demo Merchant",
        amount: 1200,
        cashbackAmount: 60,
        daysSincePurchase: 20,
        status: "pending"
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "No demo policy exists for this merchant."
    );
  });

});
