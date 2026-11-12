/**
 * Multi-Timeframe Confluence Method — pure consensus signal logic.
 *
 * Emits BUY or SELL only when all three configured trends independently
 * agree using 10/30-bar simple moving-average alignment.
 */
import type {
  DailyCandle,
  MethodSignal,
  MtfInterval,
  SignalDirection,
} from "../types/domain";

/** One completed-candle series for a selected MTF interval. */
export interface TimeframeCandles {
  readonly interval: MtfInterval;
  readonly candles: readonly DailyCandle[];
}

/** The three ordered candle series required to evaluate MTF confluence. */
export type MultiTimeframeCandles = readonly [
  TimeframeCandles,
  TimeframeCandles,
  TimeframeCandles,
];

type TrendDirection = "bullish" | "bearish" | "neutral";

const SHORT_PERIOD = 10;
const LONG_PERIOD = 30;

/**
 * Evaluate the three selected interval trends from completed candles supplied by the caller.
 * Returns null when fewer than 30 candles are available in any interval.
 */
export function evaluateMtfConfluence(
  ticker: string,
  candles: MultiTimeframeCandles,
): MethodSignal | null {
  if (new Set(candles.map((timeframe) => timeframe.interval)).size !== 3) return null;
  const series = candles.map((timeframe) => timeframe.candles);
  if (series.some((timeframe) => timeframe.length < LONG_PERIOD)) return null;

  const trends = series.map(evaluateTrend);
  const lastSeries = series[2];
  const lastCandle = lastSeries?.[lastSeries.length - 1];
  if (!lastCandle) return null;

  const direction: SignalDirection =
    trends.every((trend) => trend === "bullish")
      ? "BUY"
      : trends.every((trend) => trend === "bearish")
        ? "SELL"
        : "NEUTRAL";
  const alignment = direction === "BUY" ? "bullish" : direction === "SELL" ? "bearish" : "mixed";
  const intervals = candles.map((series) => series.interval).join("/");

  return {
    ticker,
    method: "MTFConfluence",
    direction,
    description: `${alignment} ${intervals} trend confluence (10/30 SMA)`,
    currentClose: lastCandle.close,
    evaluatedAt: lastCandle.date,
  };
}

function evaluateTrend(candles: readonly DailyCandle[]): TrendDirection {
  const lastClose = candles[candles.length - 1]!.close;
  const shortSma = averageClose(candles, SHORT_PERIOD);
  const longSma = averageClose(candles, LONG_PERIOD);

  if (lastClose > longSma && shortSma > longSma) return "bullish";
  if (lastClose < longSma && shortSma < longSma) return "bearish";
  return "neutral";
}

function averageClose(candles: readonly DailyCandle[], period: number): number {
  const start = candles.length - period;
  let total = 0;
  for (let i = start; i < candles.length; i++) {
    total += candles[i]!.close;
  }
  return total / period;
}
