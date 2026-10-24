
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
});
