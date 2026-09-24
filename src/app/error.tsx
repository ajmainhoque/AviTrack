"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="page-content">
      <h1>AviTrack could not load this view</h1>
      <p>
        No aviation data has been substituted. Your local preferences and saved
        tracks are retained.
      </p>
      <button className="button" onClick={reset}>
        Retry view
      </button>
    </main>
  );
}
