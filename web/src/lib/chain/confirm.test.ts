import { afterEach, describe, expect, it, vi } from "vitest";
import { seconds, stopwatch } from "@/lib/chain/confirm";

afterEach(() => vi.restoreAllMocks());

describe("the tap-to-receipt clock (#44)", () => {
  it("reads the milliseconds since it started", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(1_000);
    const lap = stopwatch();
    now.mockReturnValue(1_940);
    expect(lap()).toBe(940);
  });

  it("prints tenths of a second, never a negative", () => {
    expect(seconds(940)).toBe("0.9 s");
    expect(seconds(960)).toBe("1.0 s");
    expect(seconds(12_300)).toBe("12.3 s");
    expect(seconds(-5)).toBe("0.0 s");
  });
});
