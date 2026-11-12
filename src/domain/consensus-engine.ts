/**
 * Consensus Engine — Pure domain logic.
 * Ported from Dart: lib/src/domain/consensus_engine.dart
 *
 * Consensus BUY: Micho BUY + at least one other method BUY.
 * Consensus SELL: Micho SELL + at least one other method SELL.
 *
 * Micho is the primary method and carries 3× weight by default. MTFConfluence
 * is an optional direction gate; a weight of 0 disables a method.
 */
import type {
  ConsensusResult,
  ConsensusExplanation,
  MethodSignal,
  MethodName,
  MethodWeights,
  SignalDirection,
} from "../types/domain";
import { DEFAULT_METHOD_WEIGHTS } from "../types/domain";

const BUY_METHODS = new Set([
  "Micho",
  "RSI",
  "MACD",
  "Bollinger",
  "Stochastic",
  "OBV",
  "ADX",
  "CCI",
  "SAR",
  "WilliamsR",
  "MFI",
  "SuperTrend",
  "MTFConfluence",
]);

/**
 * Resolve the effective weight for a single method.
 * Uses user-provided weights, falling back to DEFAULT_METHOD_WEIGHTS, then 1.
 */
function resolveWeight(method: string, weights?: MethodWeights): number {
  if (weights && method in weights) {
    const w = weights[method as keyof MethodWeights];
    if (w !== undefined) return w;
  }
  const d = DEFAULT_METHOD_WEIGHTS[method as keyof MethodWeights];
  return d !== undefined ? d : 1;
}

/**
 * Evaluate consensus from a list of method signals for a single ticker.
 * Accepts optional per-method weights; defaults to Micho = 3×, core methods =
 * 1×, and MTFConfluence = 0× (opt-in).
 */
export function evaluateConsensus(
  ticker: string,
  signals: readonly MethodSignal[],
  weights?: MethodWeights,
): ConsensusResult {
  const buySignals = signals.filter((s) => s.direction === "BUY" && BUY_METHODS.has(s.method));
  const sellSignals = signals.filter((s) => s.direction === "SELL" && BUY_METHODS.has(s.method));

  const michoBuy = buySignals.some((s) => s.method === "Micho");
  const michoSell = sellSignals.some((s) => s.method === "Micho");
  // A positive MTF weight opts in to a hard direction gate, not just another vote.
  const mtfEnabled = resolveWeight("MTFConfluence", weights) > 0;
  const mtfBuy = buySignals.some((s) => s.method === "MTFConfluence");
  const mtfSell = sellSignals.some((s) => s.method === "MTFConfluence");

  // Weighted vote tallies
  const michoWeight = resolveWeight("Micho", weights);
  const otherBuyWeight = buySignals
    .filter((s) => s.method !== "Micho")
    .reduce((sum, s) => sum + resolveWeight(s.method, weights), 0);
  const otherSellWeight = sellSignals
    .filter((s) => s.method !== "Micho")
    .reduce((sum, s) => sum + resolveWeight(s.method, weights), 0);

  // Total theoretical denominator = sum of all active method weights
  const totalWeighted = [...BUY_METHODS].reduce((sum, m) => sum + resolveWeight(m, weights), 0);

  let direction: SignalDirection;
  let strength: number;

  const michoEnabled = michoWeight > 0;
  const otherBuyCount = buySignals.filter((s) => s.method !== "Micho").length;
  const otherSellCount = sellSignals.filter((s) => s.method !== "Micho").length;

  if (
    michoEnabled &&
    michoBuy &&
    otherBuyCount >= 1 &&
    otherBuyWeight > 0 &&
    (!mtfEnabled || mtfBuy)
  ) {
    direction = "BUY";
    strength = totalWeighted > 0 ? (michoWeight + otherBuyWeight) / totalWeighted : 0;
  } else if (
    michoEnabled &&
    michoSell &&
    otherSellCount >= 1 &&
    otherSellWeight > 0 &&
    (!mtfEnabled || mtfSell)
  ) {
    direction = "SELL";
    strength = totalWeighted > 0 ? (michoWeight + otherSellWeight) / totalWeighted : 0;
  } else {
    direction = "NEUTRAL";
    strength = 0;
  }

  const inputMethods = [...new Set(signals.map((signal) => signal.method))];
  const methodWeights: Partial<Record<MethodName, number>> = {};
  for (const method of BUY_METHODS) {
    methodWeights[method as keyof typeof methodWeights] = resolveWeight(method, weights);
  }
  const evaluatedAt = signals.reduce(
    (latest, signal) => (signal.evaluatedAt > latest ? signal.evaluatedAt : latest),
    "",
  );
  const limitations: string[] = ["Consensus uses technical signals and is not financial advice."];
  if (signals.length === 0) limitations.push("No method signals were available.");
  if (!michoEnabled)
    limitations.push("Micho is disabled, so BUY and SELL consensus cannot trigger.");
  if (michoEnabled && direction === "NEUTRAL") {
    limitations.push("A Micho signal and at least one active supporting method are required.");
  }
  if (mtfEnabled && direction === "NEUTRAL" && !mtfBuy && !mtfSell) {
    limitations.push(
      "MTFConfluence is enabled, but no aligned signal across the selected timeframes is available.",
    );
  } else if (mtfEnabled && direction === "NEUTRAL" && (mtfBuy || mtfSell)) {
    limitations.push("MTFConfluence does not confirm the primary signal, so consensus is blocked.");
  }

  const explanation: ConsensusExplanation = {
    evaluatedAt,
    inputMethods,
    methodWeights,
    limitations,
  };

  return {
    ticker,
    direction,
    buyMethods: buySignals,
    sellMethods: sellSignals,
    strength,
    explanation,
  };
}
