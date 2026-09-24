"use client";
import { useSyncExternalStore } from "react";
function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}
export function Connectivity() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  return online ? null : (
    <div className="connectivity-banner" role="status">
      Live data unavailable offline. Cached reference information may be out of
      date.
    </div>
  );
}
