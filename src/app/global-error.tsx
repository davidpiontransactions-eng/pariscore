"use client";

import { useTranslations } from "next-intl";
import { Trophy, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Minimal page — no providers, no i18n hooks (those may be broken)
  // Hardcode FR strings as fallback
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#0E1217",
          color: "#F0F3F5",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem",
          padding: "1rem",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: "rgba(244, 63, 94, 0.1)",
            color: "#fb7185",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
          }}
        >
          ⚠
        </div>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>
            Erreur critique
          </h1>
          <p style={{ fontSize: 14, color: "#9AA4AE", marginTop: 8, maxWidth: 400 }}>
            Une erreur inattendue est survenue. Notre équipe a été notifiée.
            Vous pouvez réessayer ou retourner à l'accueil.
          </p>
          {error.digest && (
            <p style={{ fontFamily: "monospace", fontSize: 11, color: "#6B7280", marginTop: 8 }}>
              ID: {error.digest}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={reset}
            style={{
              background: "#10b981",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            style={{
              background: "transparent",
              color: "#F0F3F5",
              border: "1px solid #2A313C",
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Accueil
          </button>
        </div>
      </body>
    </html>
  );
}
