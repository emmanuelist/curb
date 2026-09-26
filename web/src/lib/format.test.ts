import { describe, expect, it } from "vitest";
import { formatFixed, formatPrice, formatSize, parseDecimal } from "@/lib/format";

const PP = 10n ** 8n;
const SP = 10n ** 10n;

describe("formatting", () => {
  it("truncates, never rounds up", () => {
    expect(formatFixed(2_632_799n, PP, 6)).toBe("0.026327");
    expect(formatPrice(2_647_200n, PP)).toBe("0.026472");
  });

  it("groups whole sizes and keeps fractions below one", () => {
    expect(formatSize(3_637_564_225_696_517n, SP)).toBe("363,756");
    expect(formatSize(5_000_000_000n, SP)).toBe("0.50");
  });
});

describe("parseDecimal", () => {
  it("parses prices and sizes into exact integer units", () => {
    expect(parseDecimal("0.026320", PP)).toBe(2_632_000n);
    expect(parseDecimal("200", SP)).toBe(2_000_000_000_000n);
    expect(parseDecimal(".5", SP)).toBe(5_000_000_000n);
  });

  it("rejects anything that isn't a plain decimal within the unit's precision", () => {
    expect(parseDecimal("", PP)).toBeNull();
    expect(parseDecimal(".", PP)).toBeNull();
    expect(parseDecimal("-1", PP)).toBeNull();
    expect(parseDecimal("1e3", PP)).toBeNull();
    expect(parseDecimal("0.123456789", PP)).toBeNull();
  });
});
