/**
 * Multi-Timeframe Confluence Method tests.
 */
import { describe, it, expect } from "vitest";
import { evaluateMtfConfluence } from "../../../src/domain/mtf-confluence-method";
import type { MultiTimeframeCandles } from "../../../src/domain/mtf-confluence-method";
import { makeCandles } from "../../helpers/candle-factory";

function risingCandles(): ReturnType<typeof makeCandles> {
  return makeCandles(Array.from({ length: 40 }, (_, index) => 100 + index));
}

function fallingCandles(): ReturnType<typeof makeCandles> {
  return makeCandles(Array.from({ length: 40 }, (_, index) => 140 - index));
}

describe("evaluateMtfConfluence", () => {
  it("emits BUY when all three configured trends align bullish", () => {
    const candles = risingCandles();
    const result = evaluateMtfConfluence("AAPL", [
      { interval: "15m", candles },
      { interval: "1h", candles },
      { interval: "4h", candles },
    ]);

    expect(result?.direction).toBe("BUY");
    expect(result?.method).toBe("MTFConfluence");
    expect(result?.evaluatedAt).toBe(candles.at(-1)?.date);
    expect(result?.description).toContain("15m/1h/4h");
  });

  it("emits SELL when all three trends align bearish", () => {
    const candles = fallingCandles();
    const result = evaluateMtfConfluence("AAPL", [
      { interval: "1d", candles },
      { interval: "1w", candles },
      { interval: "1mo", candles },
    ]);

    expect(result?.direction).toBe("SELL");
    expect(result?.description).toContain("1d/1w/1mo");
  });

  it("emits NEUTRAL when timeframes disagree", () => {
    const candles = risingCandles();
    const result = evaluateMtfConfluence("AAPL", [
      { interval: "15m", candles },
      { interval: "1h", candles },
      { interval: "4h", candles: fallingCandles() },
    ]);

    expect(result?.direction).toBe("NEUTRAL");
  });

  it("returns null when the same interval is selected more than once", () => {
    const candles = risingCandles();
    expect(
      evaluateMtfConfluence("AAPL", [
        { interval: "1d", candles },
        { interval: "1d", candles },
        { interval: "1mo", candles },
      ]),
    ).toBeNull();
  });

  it("returns null when fewer than 30 candles are available in a timeframe", () => {
    const candles = risingCandles();
    const input: MultiTimeframeCandles = [
      { interval: "15m", candles: candles.slice(0, 29) },
      { interval: "1h", candles },
      { interval: "4h", candles },
    ];
    expect(evaluateMtfConfluence("AAPL", input)).toBeNull();
  });
});
