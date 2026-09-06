import { NextResponse } from "next/server";

/**
 * Health check — GET /api/v1/status
 *
 * Endpoint de santé minimal utilisé par scripts/update_vps.sh (grep '"status":"ok"')
 * et le monitoring. Doit rester sans dépendance (DB, réseau) pour rester fiable.
 *
 * Historique : l'ancien server.js legacy exposait cette route ; elle n'avait
 * jamais été portée côté Next.js — les déploys récents répondaient 404.
 */
export function GET() {
  return NextResponse.json({ status: "ok" });
}
