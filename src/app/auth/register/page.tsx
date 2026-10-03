"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * /auth/register — création de profil.
 *
 * La validation serveur fait foi : `POST /api/v1/auth/register` renvoie un
 * message par champ et c'est lui qu'on affiche. Le contrôle côté navigateur ne
 * sert qu'à éviter un aller-retour inutile.
 *
 * Les règles (longueurs, caractères autorisés du login, lettre + chiffre) sont
 * partagées avec le serveur via `src/lib/auth-profile.ts` — importer la constante
 * ici évite d'avoir deux définitions qui divergent.
 */
export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, username, password, confirmPassword }),
      });
      const payload: { error?: string } = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error ?? "Création du profil impossible.");
        return;
      }

      // Profil créé : on enchaîne directement en connexion.
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        router.push("/auth/signin");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Création du profil impossible. Réessaie dans un instant.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0c1220] px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <h1 className="text-xl font-bold text-white">Créer un profil</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Ton profil te sert à enregistrer tes paris et à suivre tes équipes.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-zinc-300">
              Adresse e-mail
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-black/30"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-zinc-300">
              Login
            </Label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              required
              minLength={3}
              maxLength={24}
              pattern="[a-z0-9._\-]+"
              placeholder="davidoo372"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-black/30"
            />
            <p className="text-xs text-zinc-500">
              Minuscules, chiffres, point, tiret et underscore. 3 à 24 caractères.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-zinc-300">
              Mot de passe
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-black/30"
            />
            <p className="text-xs text-zinc-500">
              8 caractères minimum, avec au moins une lettre et un chiffre.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-zinc-300">
              Confirmation
            </Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
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
            {pending ? "Création…" : "Créer mon profil"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-400">
          Déjà inscrit ?{" "}
          <Link href="/auth/signin" className="font-semibold text-emerald-400 hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}