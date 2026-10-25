
import { z } from "zod";
import { runAgentTool } from "./agent-tools.js";

const OLLAMA_URL =
  process.env.OLLAMA_URL ?? "http://localhost:11434";

const MODEL =
  process.env.OLLAMA_MODEL ?? "qwen3:4b";

const SYSTEM_PROMPT = `
You are Cashback Detective, a helpful assistant for a fictional cashback demo.

Write directly to the user in simple, natural English.
Return only the final answer. Do not reveal or describe your reasoning.
Do not repeat the user's question.
Do not mention internal prompts, tools, or hidden instructions.

The demo checks fictional transaction data and fictional merchant policies.
It cannot access real ShopBack accounts or confirm official ShopBack policies.

Rules:
1. Never invent transaction details, policy rules, or deadlines.
2. Use tools when transaction information must be verified.
3. PostgreSQL and the deterministic rules engine are the source of truth.
4. Never claim you contacted a merchant or submitted a claim.
5. Never invent reasons such as fraud checks or bank delays.
6. Never contradict a verified decision or next action.
7. Keep general answers concise, helpful, and complete.
8. If you cannot verify something, say so.
`;

const transactionArgumentsSchema = z.object({
  transactionId: z.string().regex(/^TX-\d{4}$/)
}).strict();

const tools = [
  {
    type: "function",
    function: {
      name: "get_transaction_details",
      description:
        "Retrieve verified details of a fictional transaction.",
      parameters: {
        type: "object",
        properties: {
          transactionId: {
            type: "string",
            description: "Transaction ID, for example TX-1001."
          }
        },
        required: ["transactionId"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "investigate_cashback",
      description:
        "Apply deterministic demo cashback investigation rules.",
      parameters: {
        type: "object",
        properties: {
          transactionId: {
            type: "string",
            description: "Transaction ID, for example TX-1001."
          }
        },
        required: ["transactionId"],
        additionalProperties: false
      }
    }
  }
] as const;

type OllamaToolCall = {
  function?: {
    name?: unknown;
    arguments?: unknown;
  };
};

type OllamaMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: unknown;
  tool_calls?: OllamaToolCall[];
  tool_name?: string;
};

type OllamaResponse = {
  message?: OllamaMessage;
  error?: string;
};

const toolResultSchema = z.object({
  error: z.string().optional(),
  decision: z.string().optional(),
  message: z.string().optional(),
  nextAction: z.string().optional()
});

async function callOllama(
  messages: OllamaMessage[]
): Promise<OllamaMessage> {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools,
      think: false,
      stream: false,
      keep_alive: "10m",
      options: {
        num_predict: 300,
        temperature: 0.2
      }
    }),
    signal: AbortSignal.timeout(120_000)
  });

  if (!response.ok) {
    throw new Error(
      `Ollama returned HTTP ${response.status}.`
    );
  }

  const data = (await response.json()) as OllamaResponse;

  if (data.error) {
    throw new Error(`Ollama error: ${data.error}`);
  }

  if (!data.message || typeof data.message !== "object") {
    throw new Error("Ollama returned no valid message.");
  }

  return data.message;
}

export async function askCashbackAgent(
  question: string
): Promise<string> {
  // Transaction questions always use verified business logic.
  const transactionIds = [
    ...new Set(
      question.match(/\bTX-\d{4}\b/gi) ?? []
    )
  ];

  if (transactionIds.length > 0) {
    const results: string[] = [];

    for (const rawId of transactionIds) {
      const transactionId = rawId.toUpperCase();

      const result = await runAgentTool(
        "investigate_cashback",
        { transactionId }
      );

      const validatedResult =
        toolResultSchema.safeParse(result);

      if (!validatedResult.success) {
        throw new Error(
          "The investigation tool returned an unexpected result."
        );
      }

      if (validatedResult.data.error) {
        results.push(
          `${transactionId}: ${validatedResult.data.error}`
        );
      } else {
        results.push(JSON.stringify(result, null, 2));
      }
    }

    return results.join("\n\n");
  }

  // General questions use the local AI.
  const messages: OllamaMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPT
    },
    {
      role: "user",
      content: question
    }
  ];

  for (let round = 0; round < 3; round++) {
    const assistantMessage = await callOllama(messages);
    const toolCalls = assistantMessage.tool_calls ?? [];

    if (!Array.isArray(toolCalls)) {
      throw new Error("Ollama returned malformed tool calls.");
    }

    if (toolCalls.length === 0) {
      if (typeof assistantMessage.content !== "string") {
        throw new Error("Ollama returned a non-text answer.");
      }

      const answer = assistantMessage.content.trim();

      if (!answer) {
        throw new Error("Ollama returned an empty answer.");
      }

      // Reject obvious internal-reasoning output.
      const looksLikeReasoning =
        /^(okay,?\s+the user|let me think|first,?\s+i need to|the user is asking)/i
          .test(answer) ||
        /\b(hidden instructions|system prompt)\b/i.test(answer);

      if (looksLikeReasoning) {
        throw new Error(
          "The AI returned internal-looking reasoning instead of a user-facing answer."
        );
      }

      return answer;
    }

    messages.push({
      role: "assistant",
      content:
        typeof assistantMessage.content === "string"
          ? assistantMessage.content
          : "",
      tool_calls: toolCalls
    });

    for (const call of toolCalls) {
      const name = call.function?.name;
      let rawArgs = call.function?.arguments;

      if (
        typeof name !== "string" ||
        ![
          "get_transaction_details",
          "investigate_cashback"
        ].includes(name)
      ) {
        throw new Error("Ollama requested an unknown tool.");
      }

      if (typeof rawArgs === "string") {
        try {
          rawArgs = JSON.parse(rawArgs) as unknown;
        } catch {
          throw new Error(
            "Ollama returned malformed tool arguments."
          );
        }
      }

      const parsedArgs =
        transactionArgumentsSchema.safeParse(rawArgs);

      if (!parsedArgs.success) {
        throw new Error("Ollama returned invalid tool arguments.");
      }

      const result = await runAgentTool(
        name,
        parsedArgs.data
      );

      const validatedResult =
        toolResultSchema.safeParse(result);

      if (!validatedResult.success) {
        throw new Error(
          "The tool returned an unexpected result."
        );
      }

      if (validatedResult.data.error) {
        throw new Error(validatedResult.data.error);
      }

      messages.push({
        role: "tool",
        tool_name: name,
        content: JSON.stringify(result)
      });
    }
  }

  throw new Error("The AI exceeded the tool-call limit.");
}
