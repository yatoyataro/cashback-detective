
import { readFile } from "node:fs/promises";

type ExpectedEvidence = {
  purchaseAmount: number;
  expectedCashback: number;
  daysSincePurchase: number;
  investigationAfterDays: number | null;
};

type EvaluationCase = {
  id: string;
  category: string;
  question: string;
  expectedStatus: number;
  expectedDecision?: string;
  expectedAnswerSource?: string;
  expectedError?: string;
  expectedAnswerContains?: string;
  expectedAnswerContainsAll?: string[];
  expectedNextAction?: string;
  expectedEvidence?: ExpectedEvidence;
};

type ApiResponse = {
  answer?: string;
  answerSource?: string;
  investigation?: {
    decision?: string;
    nextAction?: string;
    evidence?: {
      purchaseAmount?: number;
      expectedCashback?: number;
      daysSincePurchase?: number;
      investigationAfterDays?: number | null;
    };
  } | null;
  error?: string;
};

type CategoryResult = {
  passed: number;
  failed: number;
};

async function main(): Promise<void> {
  const casesPath = new URL("./cases.json", import.meta.url);
  const fileContents = await readFile(casesPath, "utf8");
  const cases = JSON.parse(fileContents) as EvaluationCase[];

  if (!Array.isArray(cases) || cases.length === 0) {
    throw new Error("Evaluation dataset must be a non-empty JSON array.");
  }

  const baseUrl = process.env.EVAL_BASE_URL ?? "http://localhost:3000";

  let passed = 0;
  let failed = 0;

  const categoryResults = new Map<string, CategoryResult>();

  console.log("\nCashback Detective Evaluation");
  console.log("=============================");
  console.log(`API: ${baseUrl}`);
  console.log(`Cases: ${cases.length}\n`);

  for (const testCase of cases) {
    const failures: string[] = [];

    try {
      const response = await fetch(`${baseUrl}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: testCase.question
        })
      });

      const body = (await response.json()) as ApiResponse;

      if (response.status !== testCase.expectedStatus) {
        failures.push(
          `status: expected ${testCase.expectedStatus}, got ${response.status}`
        );
      }

      if (
        testCase.expectedDecision &&
        body.investigation?.decision !== testCase.expectedDecision
      ) {
        failures.push(
          `decision: expected "${testCase.expectedDecision}", got "${body.investigation?.decision ?? "none"}"`
        );
      }

      if (
        testCase.expectedAnswerSource &&
        body.answerSource !== testCase.expectedAnswerSource
      ) {
        failures.push(
          `answerSource: expected "${testCase.expectedAnswerSource}", got "${body.answerSource ?? "none"}"`
        );
      }

      if (
        testCase.expectedError &&
        body.error !== testCase.expectedError
      ) {
        failures.push(
          `error: expected "${testCase.expectedError}", got "${body.error ?? "none"}"`
        );
      }

      if (
        testCase.expectedAnswerContains &&
        !body.answer?.includes(testCase.expectedAnswerContains)
      ) {
        failures.push(
          `answer must contain "${testCase.expectedAnswerContains}"`
        );
      }

      for (const phrase of testCase.expectedAnswerContainsAll ?? []) {
        if (!body.answer?.includes(phrase)) {
          failures.push(`answer is missing required phrase "${phrase}"`);
        }
      }

      if (
        testCase.expectedNextAction &&
        body.investigation?.nextAction !== testCase.expectedNextAction
      ) {
        failures.push(
          `nextAction: expected "${testCase.expectedNextAction}", got "${body.investigation?.nextAction ?? "none"}"`
        );
      }

      if (testCase.expectedEvidence) {
        const actualEvidence = body.investigation?.evidence;

        if (!actualEvidence) {
          failures.push("investigation evidence is missing");
        } else {
          for (const [field, expectedValue] of Object.entries(
            testCase.expectedEvidence
          )) {
            const actualValue =
              actualEvidence[field as keyof typeof actualEvidence];

            if (actualValue !== expectedValue) {
              failures.push(
                `evidence.${field}: expected ${expectedValue}, got ${actualValue ?? "missing"}`
              );
            }
          }
        }
      }
    } catch (error) {
      failures.push(
        error instanceof Error ? error.message : String(error)
      );
    }

    const categoryResult = categoryResults.get(testCase.category) ?? {
      passed: 0,
      failed: 0
    };

    if (failures.length === 0) {
      passed++;
      categoryResult.passed++;
      console.log(`[PASS] ${testCase.id} (${testCase.category})`);
    } else {
      failed++;
      categoryResult.failed++;
      console.log(`[FAIL] ${testCase.id} (${testCase.category})`);

      for (const failure of failures) {
        console.log(`       - ${failure}`);
      }
    }

    categoryResults.set(testCase.category, categoryResult);
  }

  const total = passed + failed;
  const passRate = total === 0 ? 0 : (passed / total) * 100;

  console.log("\nCategory Results");
  console.log("================");

  for (const [category, result] of categoryResults) {
    const categoryTotal = result.passed + result.failed;
    const categoryRate =
      categoryTotal === 0 ? 0 : (result.passed / categoryTotal) * 100;

    console.log(
      `${category}: ${result.passed}/${categoryTotal} passed (${categoryRate.toFixed(1)}%)`
    );
  }

  console.log("\nOverall Evaluation Summary");
  console.log("==========================");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${total}`);
  console.log(`Pass rate: ${passRate.toFixed(1)}%`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error("Evaluation runner failed:", error);
  process.exitCode = 1;
});
