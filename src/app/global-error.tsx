"use client";

/**
 * Catches errors in the root layout itself (the last-resort boundary). Must
 * render its own <html>/<body>.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#0b0f17", color: "#cfdaee", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#fff", margin: 0 }}>MEQ is temporarily unavailable</h1>
          <p style={{ fontSize: 13, color: "#9bb0d4", maxWidth: 420 }}>
            Something went wrong at the app level. Please retry in a moment.
          </p>
          <button
            onClick={reset}
            style={{ background: "#8ab4ff", color: "#0b0f17", fontWeight: 600, fontSize: 13, border: "none", borderRadius: 6, padding: "8px 16px", cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
