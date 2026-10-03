"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * /auth/password — changement du mot de passe du profil connecté.
 *
 * Le mot de passe actuel est exigé par la route : sans lui une session volée
 * prendrait le compte définitivement.
 */
export default function ChangePasswordPage() {
  const router = useRouter();
  const { status } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  // Sans session on renvoie vers la connexion : la page n'a rien à afficher.
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const payload: { error?: string } = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "Changement impossible.");
        return;
      }
      setDone(true);
      // La session survit au changement (JWT), mais on repart d'un état propre.
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Changement impossible. Réessaie dans un instant.");
    } finally {
      setPending(false);
    }
  }

  if (status !== "authenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0c1220]">
        <p className="text-sm text-zinc-500">Vérification de la session…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0c1220] px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <h1 className="text-xl font-bold text-white">Changer mon mot de passe</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Choisis-en un nouveau d&apos;au moins 8 caractères, avec une lettre et un chiffre.
        </p>

        {done ? (
          <div className="mt-6 space-y-4">
            <p role="status" className="text-sm text-emerald-400">
              Mot de passe mis à jour.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Retour à l&apos;accueil</Link>
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => signOut()}>
              Se déconnecter
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword" className="text-zinc-300">
                Mot de passe actuel
              </Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="bg-black/30"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPassword" className="text-zinc-300">
                Nouveau mot de passe
              </Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-black/30"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-zinc-300">
                Confirmation
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-black/30"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}

            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Mise à jour…" : "Mettre à jour"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}