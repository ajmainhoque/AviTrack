"use client";
import { useSyncExternalStore } from "react";
let now = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const subscribers = new Set<() => void>();
function subscribe(callback: () => void) {
  subscribers.add(callback);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      for (const listener of subscribers) listener();
    }, 1000);
  }
  return () => {
    subscribers.delete(callback);
    if (!subscribers.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
export const useNow = () =>
  useSyncExternalStore(
    subscribe,
    () => now,
    () => 0,
  );
