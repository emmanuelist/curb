import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TradingSession } from "@/lib/passkey/keys";

// The module keeps one session per tab, so each test gets a fresh copy of it.
const load = () => import("@/lib/curb/trading-session");
const fake = () => ({ address: "0x01e8a0919011a31E6C30a782A12496ddbbb523D1", account: {}, end: vi.fn() }) as unknown as TradingSession & { end: ReturnType<typeof vi.fn> };
const MIN = 60_000;

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("the trading session's idle lock (#42)", () => {
  it("locks itself after 15 minutes unused, ending the key and saying why", async () => {
    const s = await load();
    const key = fake();
    s.setTradingSession(key);
    expect(s.tradingLocksAt()).toBe(Date.now() + 15 * MIN);
    vi.advanceTimersByTime(15 * MIN - 1);
    expect(s.currentTradingSession()).toBe(key);
    vi.advanceTimersByTime(1);
    expect(s.currentTradingSession()).toBeNull();
    expect(key.end).toHaveBeenCalledOnce();
    expect(s.tradingLockedBy()).toBe("idle");
    expect(s.tradingLocksAt()).toBeNull();
  });

  it("pushes the deadline back each time the key is used", async () => {
    const s = await load();
    s.setTradingSession(fake());
    vi.advanceTimersByTime(10 * MIN);
    expect(s.activeTradingKey()).not.toBeNull();
    expect(s.tradingLocksAt()).toBe(Date.now() + 15 * MIN);
    vi.advanceTimersByTime(14 * MIN);
    expect(s.currentTradingSession()).not.toBeNull();
    vi.advanceTimersByTime(MIN);
    expect(s.currentTradingSession()).toBeNull();
  });

  it("refuses to hand out a key past its deadline even when the timer was held back", async () => {
    const s = await load();
    const key = fake();
    s.setTradingSession(key);
    // A phone asleep in a pocket: the clock moves, the timer doesn't fire.
    vi.setSystemTime(Date.now() + 16 * MIN);
    expect(s.activeTradingKey()).toBeNull();
    expect(key.end).toHaveBeenCalledOnce();
    expect(s.tradingLockedBy()).toBe("idle");
  });

  it("tells a Lock tap apart from the timeout, and clears the reason on the next unlock", async () => {
    const s = await load();
    s.setTradingSession(fake());
    s.lockTrading();
    expect(s.tradingLockedBy()).toBe("you");
    s.setTradingSession(fake());
    expect(s.tradingLockedBy()).toBeNull();
    vi.advanceTimersByTime(15 * MIN);
    expect(s.tradingLockedBy()).toBe("idle");
  });

  it("tells every screen when it locks", async () => {
    const s = await load();
    const heard = vi.fn();
    s.subscribeTradingSession(heard);
    s.setTradingSession(fake());
    heard.mockClear();
    vi.advanceTimersByTime(15 * MIN);
    expect(heard).toHaveBeenCalledOnce();
  });
});
