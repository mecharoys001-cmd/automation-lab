"use client";
import { useState } from "react";

const SCHEDULER_URL =
  "https://script.google.com/macros/s/AKfycbztdub4IHfDhbD2y7Zp3w5wS3oexxhLh54mOeoC8HtVd6PjG9OiU0iGqv9oswbDbXZaMg/exec";

export default function CampSchedulerEmbed() {
  const [embedFailed, setEmbedFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  return (
    <div
      style={{
        backgroundColor: "#0a0e1a",
        borderTop: "1px solid #1e293b",
        borderBottom: "1px solid #1e293b",
      }}
    >
      <div
        style={{
          maxWidth: "1600px",
          margin: "0 auto",
          padding: "0 1.5rem",
        }}
      >
        {/* Toolbar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1rem 0",
            borderBottom: "1px solid #1e293b",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "6px",
              }}
            >
              {["#ef4444", "#f59e0b", "#10b981"].map((color) => (
                <div
                  key={color}
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    backgroundColor: color,
                  }}
                />
              ))}
            </div>
            <div
              style={{
                backgroundColor: "#111827",
                border: "1px solid #1e293b",
                borderRadius: "8px",
                padding: "6px 14px",
                fontSize: "12px",
                color: "#64748b",
                fontFamily: "monospace",
                maxWidth: "400px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {SCHEDULER_URL}
            </div>
          </div>
          <a
            href={SCHEDULER_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: "#64748b",
              textDecoration: "none",
              fontSize: "12px",
              padding: "6px 12px",
              border: "1px solid #1e293b",
              borderRadius: "8px",
            }}
          >
            ↗ Open full screen
          </a>
        </div>

        {/* Embed frame */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "800px",
            backgroundColor: "#111827",
          }}
        >
          {/* Loading state */}
          {loading && !embedFailed && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "1rem",
                color: "#64748b",
                zIndex: 1,
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  border: "3px solid #1e293b",
                  borderTopColor: "#10b981",
                  animation: "spin 1s linear infinite",
                }}
              />
              <span style={{ fontSize: "14px" }}>Loading Camp Scheduler…</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Fallback if iframe fails */}
          {embedFailed ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "1.5rem",
                padding: "2rem",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "3rem" }}>📅</div>
              <h3 style={{ fontSize: "18px", fontWeight: 700 }}>
                Camp Scheduler
              </h3>
              <p style={{ color: "#64748b", fontSize: "14px", maxWidth: "400px", lineHeight: 1.6 }}>
                The scheduler runs as a Google Apps Script web app. Click below
                to open it in a new tab for the full experience.
              </p>
              <a
                href={SCHEDULER_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  backgroundColor: "#10b981",
                  color: "#fff",
                  padding: "14px 28px",
                  borderRadius: "10px",
                  fontSize: "15px",
                  fontWeight: 600,
                  textDecoration: "none",
                  boxShadow: "0 0 20px rgba(16, 185, 129, 0.3)",
                }}
              >
                Open Camp Scheduler →
              </a>
              <p style={{ fontSize: "12px", color: "#475569" }}>
                Free · No login required · Runs on Google Apps Script
              </p>
            </div>
          ) : (
            <iframe
              src={SCHEDULER_URL}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                display: loading ? "none" : "block",
              }}
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setEmbedFailed(true);
              }}
              title="Camp Scheduler"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            />
          )}
        </div>

        {/* Note */}
        <div
          style={{
            padding: "0.75rem 0",
            fontSize: "12px",
            color: "#475569",
            textAlign: "center",
          }}
        >
          If the scheduler doesn&apos;t load above,{" "}
          <a
            href={SCHEDULER_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#10b981", textDecoration: "none" }}
          >
            open it directly ↗
          </a>{" "}
          — Google Apps Script apps may require sign-in on first use.
        </div>
      </div>
    </div>
  );
}
