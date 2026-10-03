"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * /auth/signin — connexion par e-mail + mot de passe.
 *
 * La page existait dans `authOptions.pages` depuis le début
 * (`src/app/api/auth/[...nextauth]/route.ts`) mais n'a jamais été écrite : toute
 * erreur de connexion renvoyait un 404. Cf. bead `ParisScorebis-2tpn`.
 *
 * `signIn("credentials", { redirect: false })` : NextAuth renvoie
 * `{ error }` sans navigation, donc le message d'erreur reste affiché dans la
 * page au lieu de repartir sur `/auth/error`.
 */
export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        // Message volontairement identique pour « e-mail inconnu » et « mot de
        // passe faux » : sinon la page confirme l'existence d'un compte.
        setError("E-mail ou mot de passe incorrect.");
        return;
      }
      window.location.href = "/";
    } catch {
      setError("Connexion impossible pour le moment. Réessaie dans un instant.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0c1220] px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <h1 className="text-xl font-bold text-white">Connexion</h1>
        <p className="mt-1 text-sm text-zinc-400">Accède à tes pronostics et tes paris.</p>

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
            <Label htmlFor="password" className="text-zinc-300">
              Mot de passe
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-black/30"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Connexion…" : "Se connecter"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-400">
          Pas encore de profil ?{" "}
          <Link href="/auth/register" className="font-semibold text-emerald-400 hover:underline">
            Créer un profil
          </Link>
        </p>
      </div>
    </main>
  );
}