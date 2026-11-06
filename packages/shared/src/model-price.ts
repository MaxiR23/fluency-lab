// INFO: the single constant for the tutor model. Its price is in MODEL_PRICES.
export const TUTOR_MODEL = "claude-haiku-5-5";

export const MODEL_IDS = [TUTOR_MODEL] as const;

export type ModelId = (typeof MODEL_IDS)[number];

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
};

type Tier = {
  input: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
  cacheRead: number;
  output: number;
};

type ModelPrice = { promptTierLimit: number; standard: Tier; long: Tier };

// INFO: USD per million tokens. A request is priced by its prompt length: the
// input tokens plus the cache writes and reads.
export const MODEL_PRICES: Record<ModelId, ModelPrice> = {
  "claude-haiku-5-5": {
    promptTierLimit: 100000,
    standard: { input: 0.1, cacheWrite5m: 0.125, cacheWrite1h: 0.2, cacheRead: 0.01, output: 0.5 },
    long: { input: 0.5, cacheWrite5m: 0.625, cacheWrite1h: 1, cacheRead: 0.05, output: 2.5 },
  },
};

// INFO: cache writes are priced at the 5-minute rate: the app sends no
// cache_control, and the usage fields do not split writes by TTL.
export function usageCostUsd(model: ModelId, usage: TokenUsage): number {
  const price = MODEL_PRICES[model];
  const promptLength =
    usage.inputTokens + usage.cacheCreationInputTokens + usage.cacheReadInputTokens;
  const tier = promptLength <= price.promptTierLimit ? price.standard : price.long;
  const perMillion =
    usage.inputTokens * tier.input +
    usage.cacheCreationInputTokens * tier.cacheWrite5m +
    usage.cacheReadInputTokens * tier.cacheRead +
    usage.outputTokens * tier.output;
  return Math.round((perMillion / 1e6) * 1e8) / 1e8;
}
