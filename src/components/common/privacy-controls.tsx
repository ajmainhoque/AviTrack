"use client";
import { useState } from "react";
import { clearTracks } from "@/lib/client/history";
import { usePreferences } from "@/lib/client/store";
export function PrivacyControls() {
  const [status, setStatus] = useState("");
  const clear = async () => {
    if (
      !window.confirm(
        "Delete local trajectories, favorites, recent searches, settings and AviTrack offline caches from this browser?",
      )
    )
      return;
    try {
      await clearTracks();
      usePreferences.setState({ favorites: [], recentSearches: [] });
      usePreferences.persist.clearStorage();
      if ("caches" in window)
        for (const name of await caches.keys())
          if (name.startsWith("avitrack-")) await caches.delete(name);
      setStatus(
        "Local data cleared. Reload to reset active in-memory observations.",
      );
    } catch {
      setStatus(
        "Some browser storage could not be cleared. Use your browser's site-data settings.",
      );
    }
  };
  return (
    <div>
      <button className="button" onClick={clear}>
        Clear local AviTrack data
      </button>
      <p className="inline-note" role="status">
        {status}
      </p>
    </div>
  );
}
