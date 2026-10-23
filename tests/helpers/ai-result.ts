import type { GenerateTextResult, ToolSet } from "ai";

/** A `generateText` result with the fields production reads: text, plus model, finish reason and usage for its span. */
export function textResult(text: string): GenerateTextResult<ToolSet, never, never> {
  // SAFETY: the code under test reads no other result member.
  return {
    text,
    finishReason: "stop",
    usage: { inputTokens: 1200, outputTokens: 800 },
    response: { modelId: "test-model" },
  } as GenerateTextResult<ToolSet, never, never>;
}
