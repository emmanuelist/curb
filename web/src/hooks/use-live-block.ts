"use client";

import { useSyncExternalStore } from "react";
import { getWsClient } from "@/lib/chain/clients";

export type BlockStatus = "connecting" | "live" | "stalled" | "error";

export type BlockState = {
  block: bigint | null;
  receivedAt: number | null;
  status: BlockStatus;
  /** Advances by one per block notification. Drives the lane dashes, so motion stops when blocks stop. */
  step: number;
  /** Rolling mean of the gaps between the last blocks seen, in ms; null until two have arrived. */
  avgIntervalMs: number | null;
};

/** No block for this long means the stream has stalled: the lane stops moving and says so. */
const STALL_MS = 2_500;

const INITIAL: BlockState = { block: null, receivedAt: null, status: "connecting", step: 0, avgIntervalMs: null };
const WINDOW = 12;
let gaps: number[] = [];

let state: BlockState = INITIAL;
const listeners = new Set<() => void>();
let unwatch: (() => void) | null = null;
let stallTimer: ReturnType<typeof setTimeout> | undefined;

function emit(next: BlockState) {
  state = next;
  for (const listener of listeners) listener();
}

function armStall() {
  clearTimeout(stallTimer);
  stallTimer = setTimeout(() => emit({ ...state, status: "stalled" }), STALL_MS);
}

function start() {
  if (unwatch) return;
  unwatch = getWsClient().watchBlockNumber({
    emitOnBegin: true,
    onBlockNumber: (block) => {
      if (state.block !== null && block <= state.block) return;
      const now = Date.now();
      if (state.receivedAt !== null && state.block !== null) {
        // Spread the gap over every block that arrived, so a skipped notification doesn't read as a slow block.
        const per = (now - state.receivedAt) / Number(block - state.block);
        gaps = [...gaps, per].slice(-WINDOW);
      }
      const avgIntervalMs = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
      emit({ block, receivedAt: now, status: "live", step: state.step + 1, avgIntervalMs });
      armStall();
    },
    onError: () => emit({ ...state, status: "error" }),
  });
  armStall();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      unwatch?.();
      unwatch = null;
      clearTimeout(stallTimer);
      state = { ...state, status: "connecting" };
    }
  };
}

/** Live Monad block stream over WebSocket (one shared subscription). */
export function useLiveBlock(): BlockState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL,
  );
}
