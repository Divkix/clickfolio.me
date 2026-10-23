import type { GenerateTextResult, LanguageModelUsage, ToolSet } from "ai";

const USAGE: LanguageModelUsage = {
  inputTokens: 1200,
  inputTokenDetails: { noCacheTokens: 1000, cacheReadTokens: 200, cacheWriteTokens: undefined },
  outputTokens: 800,
  outputTokenDetails: { textTokens: 600, reasoningTokens: 200 },
  totalTokens: 2000,
  raw: { prompt_tokens: 1200, completion_tokens: 800, cost: 0.0042 },
};

/** A `generateText` result with the fields production reads: text, plus model, finish reason and usage for its span and usage event. */
export function textResult(text: string): GenerateTextResult<ToolSet, never, never> {
  // SAFETY: the code under test reads no other result member.
  return {
    text,
    finishReason: "stop",
    usage: USAGE,
    response: { modelId: "test-model" },
  } as GenerateTextResult<ToolSet, never, never>;
}
