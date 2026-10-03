"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";

/**
 * /auth/error — page d'erreur d'authentification.
 *
 * Déclarée dans `authOptions.pages.error` depuis le début, jamais écrite : toute
 * erreur de connexion tombait sur une 404 (et, en prod, sur le 404 FastAPI du
 * proxy nginx — voir bead `ParisScorebis-2tpn`).
 *
 * `error` est un code court, pas un message : on ne le retransmet pas tel quel
 * sans le traduire, sinon la page affiche une valeur technique.
 */
const MESSAGES: Record<string, string> = {
  Configuration: "La connexion est mal configurée sur le serveur.",
  AccessDenied: "Accès refusé.",
  Verification: "Lien de vérification expiré, reprends depuis le début.",
  OAuthAccountNotLinked: "Cette adresse est déjà liée à un autre mode de connexion.",
  EmailCreateAccount: "Impossible de créer le profil depuis ce mode de connexion.",
  Callback: "Erreur pendant le retour du fournisseur d'authentification.",
  OAuthSignin: "Erreur pendant la connexion au fournisseur.",
  OAuthCallback: "Erreur dans la réponse du fournisseur.",
  CredentialsSignin: "E-mail ou mot de passe incorrect.",
};

function ErrorInner() {
  const params = useSearchParams();
  const code = params.get("error") ?? "";
  const message = MESSAGES[code] ?? "La connexion a échoué. Réessaie dans un instant.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0c1220] px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-center">
        <h1 className="text-xl font-bold text-white">Connexion impossible</h1>
        <p role="alert" className="mt-2 text-sm text-zinc-400">
          {message}
        </p>
        {code && (
          <p className="mt-3 text-xs text-zinc-600">
            Code : <code>{code}</code>
          </p>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild>
            <Link href="/auth/signin">Réessayer</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/auth/register">Créer un profil</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

// `useSearchParams` exige un Suspendant au-dessus en App Router.
export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#0c1220]">
          <p className="text-sm text-zinc-500">Chargement…</p>
        </main>
      }
    >
      <ErrorInner />
    </Suspense>
  );
}