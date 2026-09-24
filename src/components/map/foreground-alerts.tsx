"use client";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { Bell, Trash2 } from "lucide-react";
import { usePreferences, useTracker } from "@/lib/client/store";
import { observationAlerts } from "@/lib/aviation/alerts";
import { freshness } from "@/lib/aviation/calculations";
import { formatTime } from "@/lib/aviation/units";
import { IconButton } from "../common/icon-button";
interface AlertEntry { message: string; timestamp: number; aircraftId: string }
export const useAlerts = create<{ entries: AlertEntry[] }>(() => ({ entries: [] }));
function emit(message: string, aircraftId: string) {
  const timestamp = Date.now();
  if (useAlerts.getState().entries.some((entry) => entry.message === message && timestamp - entry.timestamp < 60000)) return;
  useAlerts.setState((state) => ({ entries: [{ message, aircraftId, timestamp }, ...state.entries].slice(0, 30) }));
  if (usePreferences.getState().browserNotifications && "Notification" in window && Notification.permission === "granted") new Notification("AviTrack observation", { body: message, tag: aircraftId });
}
export function ForegroundAlertMonitor() {
  useEffect(() => {
    const stale = new Set<string>();
    const unsubscribe = useTracker.subscribe((state, previous) => {
      if (document.hidden || !usePreferences.getState().foregroundAlerts) return;
      const watched = new Set(usePreferences.getState().favorites.filter((entry) => entry.type !== "airport").map((entry) => entry.id));
      if (state.selected) watched.add(state.selected);
      for (const id of watched) { const aircraft = state.aircraft[id]; if (!aircraft || aircraft === previous.aircraft[id]) continue; for (const message of observationAlerts(previous.aircraft[id], aircraft, Date.now())) emit(message, id); }
    });
    const timer = setInterval(() => {
      if (document.hidden || !usePreferences.getState().foregroundAlerts) return;
      const state = useTracker.getState(); const aircraft = state.selected ? state.aircraft[state.selected] : null;
      if (!aircraft) return;
      const status = freshness(aircraft.position?.observedAt ?? null);
      if (["stale", "lost"].includes(status) && !stale.has(aircraft.id)) { emit(`${aircraft.callsign?.value || aircraft.id}: selected position is ${status}`, aircraft.id); stale.add(aircraft.id); }
      if (status === "live") stale.delete(aircraft.id);
    }, 5000);
    return () => { unsubscribe(); clearInterval(timer); };
  }, []);
  return null;
}
export function AlertList() {
  const preferences = usePreferences(); const entries = useAlerts((state) => state.entries); const [permission, setPermission] = useState("");
  async function requestPermission() { if (!("Notification" in window)) { setPermission("Browser notifications are not supported."); return; } const result = await Notification.requestPermission(); preferences.update({ browserNotifications: result === "granted", foregroundAlerts: result === "granted" || preferences.foregroundAlerts }); setPermission(result === "granted" ? "Notifications enabled while this page is monitoring." : "Notification permission was not granted."); }
  return <><label className="toggle-row"><span>Foreground observation alerts</span><input type="checkbox" checked={preferences.foregroundAlerts} onChange={(event) => preferences.update({ foregroundAlerts: event.target.checked })} /></label><label className="toggle-row"><span>Browser notifications</span><input type="checkbox" checked={preferences.browserNotifications} onChange={(event) => { if (event.target.checked) requestPermission(); else preferences.update({ browserNotifications: false }); }} /></label><p className="inline-note">Watched/selected aircraft in current coverage only. No monitoring in a hidden tab or after this page closes.</p>{permission && <p className="inline-note" role="status">{permission}</p>}<div className="section-heading"><h3>Recent observations</h3><IconButton label="Clear foreground alerts" onClick={() => useAlerts.setState({ entries: [] })}><Trash2 size={15} /></IconButton></div>{entries.length ? entries.map((entry) => <div className="alert-entry" key={`${entry.timestamp}:${entry.message}`}><button className="text-button" onClick={() => useTracker.getState().select(entry.aircraftId)}><Bell size={13} />{entry.message}</button><small>{formatTime(entry.timestamp, preferences.timeZone, true)}</small></div>) : <p className="empty-inline">No foreground alerts.</p>}</>;
}