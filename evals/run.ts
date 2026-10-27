
import { readFile } from "node:fs/promises";
import { z } from "zod";

const evaluationCaseSchema = z.object({
  id: z.string().min(1),
  category: z.enum([
    "transaction_decision",
    "error_handling",
    "safe_response"
  ]),
  question: z.string(),
  expectedStatus: z.number().int().min(100).max(599),
  expectedDecision: z.string().optional(),
  expectedAnswerSource: z.string().optional(),
  expectedError: z.string().optional(),
  expectedAnswerContains: z.string().optional(),
  expectedAnswerContainsAll: z.array(z.string()).optional(),
  expectedNextAction: z.string().optional(),
  expectedEvidence: z.object({
    purchaseAmount: z.number().optional(),
    expectedCashback: z.number().optional(),
    daysSincePurchase: z.number().optional(),
    investigationAfterDays: z.number().optional()
  }).optional()
});

const evaluationCasesSchema = z.array(evaluationCaseSchema).min(1);

type EvaluationCase = z.infer<typeof evaluationCaseSchema>;

type EvaluationResponse = {
  answer?: string;
  answerSource?: string;
  investigation?: {
    decision?: string;
    nextAction?: string;
    evidence?: Record<string, unknown>;
  };
  error?: string;
};

type CategoryResult = {
  passed: number;
  failed: number;
};

const baseUrl =
  process.env.EVAL_BASE_URL ?? "http://localhost:3000";

async function loadCases(): Promise<EvaluationCase[]> {
  const fileContents = await readFile(
    new URL("./cases.json", import.meta.url),
    "utf8"
  );

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(fileContents);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    throw new Error(`evals/cases.json contains invalid JSON: ${message}`);
  }

  const validation = evaluationCasesSchema.safeParse(parsedJson);

  if (!validation.success) {
    console.error("\nInvalid evaluation dataset:");
    console.error(
      JSON.stringify(validation.error.format(), null, 2)
    );

    throw new Error(
      "Fix the validation errors in evals/cases.json before running evaluations."
    );
  }

  const cases = validation.data;
  const ids = cases.map((testCase) => testCase.id);
  const duplicateIds = ids.filter(
    (id, index) => ids.indexOf(id) !== index
  );

  if (duplicateIds.length > 0) {
    throw new Error(
      `Duplicate evaluation case IDs: ${[...new Set(duplicateIds)].join(", ")}`
    );
  }

  return cases;
}

async function main(): Promise<void> {
  let cases: EvaluationCase[];

  try {
    cases = await loadCases();
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
    return;
  }

  let passed = 0;
  let failed = 0;

  const categoryResults = new Map<string, CategoryResult>();

  console.log("\nCashback Detective Evaluation");
  console.log("=============================");
  console.log(`API: ${baseUrl}`);
  console.log(`Cases: ${cases.length}`);
  console.log("Dataset validation: passed\n");

  for (const testCase of cases) {
    const failures: string[] = [];

    let response: Response;
    let body: EvaluationResponse;

    try {
      response = await fetch(`${baseUrl}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: testCase.question
        })
      });

      body = (await response.json()) as EvaluationResponse;
    } catch (error) {
      failures.push(
        `API request failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      const categoryResult =
        categoryResults.get(testCase.category) ?? {
          passed: 0,
          failed: 0
        };

      failed++;
      categoryResult.failed++;
      categoryResults.set(testCase.category, categoryResult);

      console.log(`[FAIL] ${testCase.id} (${testCase.category})`);

      for (const failure of failures) {
        console.log(`       - ${failure}`);
      }

      continue;
    }

    if (response.status !== testCase.expectedStatus) {
      failures.push(
        `Expected HTTP ${testCase.expectedStatus}, got ${response.status}`
      );
    }

    if (
      testCase.expectedDecision !== undefined &&
      body.investigation?.decision !== testCase.expectedDecision
    ) {
      failures.push(
        `Expected decision "${testCase.expectedDecision}", got "${body.investigation?.decision ?? "missing"}"`
      );
    }

    if (
      testCase.expectedAnswerSource !== undefined &&
      body.answerSource !== testCase.expectedAnswerSource
    ) {
      failures.push(
        `Expected answerSource "${testCase.expectedAnswerSource}", got "${body.answerSource ?? "missing"}"`
      );
    }

    if (
      testCase.expectedError !== undefined &&
      body.error !== testCase.expectedError
    ) {
      failures.push(
        `Expected error "${testCase.expectedError}", got "${body.error ?? "missing"}"`
      );
    }

    if (
      testCase.expectedAnswerContains !== undefined &&
      !body.answer?.includes(testCase.expectedAnswerContains)
    ) {
      failures.push(
        `Answer did not contain "${testCase.expectedAnswerContains}"`
      );
    }

    if (testCase.expectedAnswerContainsAll !== undefined) {
      for (const phrase of testCase.expectedAnswerContainsAll) {
        if (!body.answer?.includes(phrase)) {
          failures.push(`Answer did not contain "${phrase}"`);
        }
      }
    }

    if (testCase.expectedNextAction !== undefined) {
      const actualNextAction = body.investigation?.nextAction;

      if (actualNextAction !== testCase.expectedNextAction) {
        failures.push(
          `Expected nextAction "${testCase.expectedNextAction}", got "${actualNextAction ?? "missing"}"`
        );
      }
    }

    if (testCase.expectedEvidence !== undefined) {
      const actualEvidence = body.investigation?.evidence;

      if (!actualEvidence) {
        failures.push("Expected evidence, but no evidence was returned");
      } else {
        for (const [key, expectedValue] of Object.entries(
          testCase.expectedEvidence
        )) {
          if (actualEvidence[key] !== expectedValue) {
            failures.push(
              `Expected evidence.${key} to be ${expectedValue}, got ${String(actualEvidence[key])}`
            );
          }
        }
      }
    }

    const categoryResult =
      categoryResults.get(testCase.category) ?? {
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
  console.error(
    "Evaluation runner failed:",
    error instanceof Error ? error.message : String(error)
  );
  process.exitCode = 1;
});
