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
};

/** No block for this long means the stream has stalled: the lane stops moving and says so. */
const STALL_MS = 2_500;

const INITIAL: BlockState = { block: null, receivedAt: null, status: "connecting", step: 0 };

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
      emit({ block, receivedAt: Date.now(), status: "live", step: state.step + 1 });
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
