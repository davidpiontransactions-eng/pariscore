// Route SSE (Server-Sent Events) — stream live des matchs de tennis.
//
// Première route web-stream du projet (les SSE existants sont dans server.js
// legacy via res.write). On utilise la spec web standard `new Response(stream)`
// qui est supportée par Bun et Node 18+.
//
// Source unique : le broker `live-broker.ts` (1 seul poller BSD pour tous les
// clients SSE connectés — évite l'explosion de charge N×).
//
// Cycle de vie :
//   1. Connexion → envoie `event: snapshot` avec l'état courant (même si stale)
//   2. Broker notifie un changement → envoie `event: update`
//   3. Heartbeat `: hb` toutes les 25s (franchit le timeout nginx 60s)
//   4. Déconnexion client (signal.abort) → unsubscribe + ferme le stream
//
// Rétro-compatibilité : la route REST /api/tennis/live reste inchangée. Les
// clients sans EventSource (Firefox/Safari anciens) continuent à l'utiliser.

import { subscribe, getSnapshot } from "@/lib/live-broker";

// Format d'un message SSE : `event: <name>\ndata: <json>\n\n`.
function sseMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: Request): Promise<Response> {
  // Encoding une fois pour toutes (le broker pousse du JSON).
  const encoder = new TextEncoder();

  // Stream lisible côté serveur. On garde un référence au controller pour
  // pouvoir écrire depuis le callback du broker ET depuis le heartbeat.
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;

      // 1. Snapshot initial (même si stale — le client a besoin d'un point de départ).
      const initial = getSnapshot();
      controller.enqueue(encoder.encode(sseMessage("snapshot", initial)));

      // 2. Abonnement aux maj broker (uniquement sur changement de score).
      const unsubscribe = subscribe((matches) => {
        if (!controller) return;
        try {
          controller.enqueue(encoder.encode(sseMessage("update", { matches })));
        } catch {
          // Controller peut être fermé entre-temps → unsubscribe nettoie.
          unsubscribe();
        }
      });

      // 3. Heartbeat 25s : garde la connexion vivante (nginx kill à 60s d'inactivité).
      // Commentaire SSE (`:`) = ignoré par EventSource mais reset le timer.
      const heartbeat = setInterval(() => {
        if (!controller) return;
        try {
          controller.enqueue(encoder.encode(`: hb ${Date.now()}\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);

      // 4. Cleanup : le client ferme l'onglet, le navigateur coupe le réseau,
      //    ou Bun/Node kill la requête. On libère broker + timers.
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller?.close();
        } catch {
          // déjà fermé
        }
        controller = null;
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // CRUCIAL derrière nginx/proxy : sinon le proxy bufferise le stream et
      // le client ne reçoit les données qu'à la déconnexion (effet "stream figé").
      "X-Accel-Buffering": "no",
    },
  });
}
