"use client";
import { useEffect, useState } from "react";
import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { Pause, Play, Radio, SkipBack } from "lucide-react";
import { useTracker, usePreferences } from "@/lib/client/store";
import { convert, formatTime, unitLabel } from "@/lib/aviation/units";
import { IconButton } from "../common/icon-button";
export default function TrackCharts() {
  const trail = useTracker((state) => state.trail);
  const cursor = useTracker((state) => state.hoverTime);
  const playback = useTracker((state) => state.playbackTime);
  const units = usePreferences((state) => state.units);
  const zone = usePreferences((state) => state.timeZone);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const state = useTracker.getState();
      const next =
        (state.playbackTime ?? state.trail[0]?.timestamp ?? 0) + 500 * speed;
      const last = state.trail.at(-1)?.timestamp ?? next;
      useTracker.setState({ playbackTime: Math.min(last, next) });
      if (next >= last) setPlaying(false);
    }, 500);
    return () => clearInterval(timer);
  }, [playing, speed]);
  useEffect(
    () => () => useTracker.setState({ playbackTime: null, hoverTime: null }),
    [],
  );
  if (trail.length < 2)
    return (
      <section className="empty-inline">
        Waiting for consecutive observed positions. History begins when an
        aircraft is selected.
      </section>
    );
  const step = Math.max(1, Math.ceil(trail.length / 600));
  const data = trail
    .filter((_, index) => index % step === 0 || index === trail.length - 1)
    .map((point) => ({
      time: point.timestamp,
      altitude:
        typeof point.altitude === "number"
          ? convert(point.altitude, "altitude", units)
          : null,
      speed: point.speed == null ? null : convert(point.speed, "speed", units),
      verticalRate:
        point.verticalRate == null
          ? null
          : convert(point.verticalRate, "verticalRate", units),
    }));
  return (
    <section className="charts">
      <div className="section-heading">
        <h2>{playback ? "Local playback" : "Observed history"}</h2>
        <button
          className="text-button"
          onClick={() =>
            usePreferences
              .getState()
              .update({ timeZone: zone === "UTC" ? "local" : "UTC" })
          }
        >
          {zone}
        </button>
      </div>
      <div className="playback-controls">
        <IconButton
          label="Restart playback"
          onClick={() =>
            useTracker.setState({ playbackTime: trail[0].timestamp })
          }
        >
          <SkipBack size={16} />
        </IconButton>
        <IconButton
          label={playing ? "Pause playback" : "Play captured history"}
          onClick={() => {
            if (!playback)
              useTracker.setState({ playbackTime: trail[0].timestamp });
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </IconButton>
        <select
          aria-label="Playback speed"
          value={speed}
          onChange={(event) => setSpeed(Number(event.target.value))}
        >
          {[1, 2, 5, 10].map((value) => (
            <option key={value} value={value}>
              {value}x
            </option>
          ))}
        </select>
        <button
          className="button"
          onClick={() => {
            setPlaying(false);
            useTracker.setState({ playbackTime: null });
          }}
        >
          <Radio size={14} />
          Live
        </button>
      </div>
      <div className="small-mono playback-time">
        {formatTime(playback ?? trail.at(-1)!.timestamp, zone, true)}
      </div>
      <input
        className="wide"
        aria-label="Playback timestamp"
        type="range"
        min={trail[0].timestamp}
        max={trail.at(-1)!.timestamp}
        value={playback ?? trail.at(-1)!.timestamp}
        onChange={(event) =>
          useTracker.setState({ playbackTime: Number(event.target.value) })
        }
      />
      {(["altitude", "speed", "verticalRate"] as const).map((quantity) => (
        <div className="chart" key={quantity}>
          <div className="section-heading">
            <h3>
              {quantity === "verticalRate"
                ? "Vertical rate"
                : quantity === "altitude"
                  ? "Barometric altitude"
                  : "Groundspeed"}
            </h3>
            <span className="small-mono">{unitLabel(quantity, units)}</span>
          </div>
          <ResponsiveContainer width="100%" height={155}>
            <LineChart
              data={data}
              syncId="observed-track"
              onMouseMove={(state) => {
                if (state.activeLabel != null)
                  useTracker.setState({ hoverTime: Number(state.activeLabel) });
              }}
              onMouseLeave={() => useTracker.setState({ hoverTime: null })}
            >
              <CartesianGrid
                strokeDasharray="2 4"
                vertical={false}
                stroke="var(--border)"
              />
              <XAxis
                dataKey="time"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(time: number) =>
                  formatTime(time, zone).split(" ")[0]
                }
                tick={{ fontSize: 9 }}
                minTickGap={45}
              />
              <YAxis
                width={48}
                tick={{ fontSize: 9 }}
                tickFormatter={(value: number) =>
                  Math.round(value).toLocaleString()
                }
              />
              <Tooltip
                labelFormatter={(time) => formatTime(Number(time), zone, true)}
                contentStyle={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                  borderRadius: 4,
                  fontSize: 11,
                }}
              />
              <Line
                type="linear"
                dataKey={quantity}
                stroke={
                  quantity === "altitude"
                    ? "#008b82"
                    : quantity === "speed"
                      ? "#cb672a"
                      : "#8472ad"
                }
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
              {(cursor || playback) && (
                <ReferenceLine
                  x={playback ?? cursor ?? undefined}
                  stroke="#cb672a"
                />
              )}
              {quantity === "altitude" && (
                <Brush dataKey="time" height={14} tickFormatter={() => ""} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}
      <p className="inline-note">
        Solid trail: observed positions. Dashed: direct route reference. Dotted:
        estimated projected track. Gaps are not reconstructed.
      </p>
    </section>
  );
}
