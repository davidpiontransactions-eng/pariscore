import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GithubProvider from "next-auth/providers/github";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

/**
 * Configuration NextAuth v4 — ParisCore.
 *
 * ⚠️ Avant ce correctif, `authorize()` acceptait **n'importe quel** email avec un
 * mot de passe de 4 caractères et renvoyait `role: "freemium"` en dur : la
 * connexion ne vérifiait rien. Maintenant le profil est lu en base et le mot de
 * passe comparé au hash scrypt. Cf. bead `ParisScorebis-2tpn`.
 *
 * Variables d'environnement requises :
 * - NEXTAUTH_SECRET (obligatoire)
 * - NEXTAUTH_URL (auto-detecté en production)
 *
 * Optionnels :
 * - GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET
 * - GITHUB_ID + GITHUB_SECRET
 */

export const authOptions: NextAuthOptions = {
  providers: [
    // Email + mot de passe : profil réel, hash scrypt vérifié en base.
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "email@example.com" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        // Compte absent, ou compte OAuth sans mot de passe : échec.
        if (!user?.passwordHash) return null;
        if (!verifyPassword(password, user.passwordHash)) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.username ?? user.name ?? user.email.split("@")[0],
          // Le rôle vient de la base — plus jamais d'une constante en dur.
          role: user.role,
          username: user.username,
        };
      },
    }),

    // Google OAuth (optionnel — activé si les variables existent)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),

    // GitHub OAuth (optionnel — activé si les variables existent)
    ...(process.env.GITHUB_ID && process.env.GITHUB_SECRET
      ? [
          GithubProvider({
            clientId: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
          }),
        ]
      : []),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 jours
  },

  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },

  callbacks: {
    /**
     * Création de profil obligatoire : un compte qui se connecte via Google ou
     * GitHub n'existe pas forcément en base. Plutôt que de refuser (l'utilisateur
     * perdrait son accès OAuth), on crée son profil au premier passage — sans
     * mot de passe, donc non connectable par email/mdp.
     *
     * Le login est dérivé de l'email et suffixé si déjà pris : deux personnes
     * peuvent partager un même domaine sans que l'une écrase l'autre.
     */
    async signIn({ user, account, profile }) {
      const email = user.email?.trim().toLowerCase();
      if (!email) return false;
      if (account?.provider === "credentials") return true;

      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) return true;

      const base = (email.split("@")[0] ?? "profil").replace(/[^a-z0-9._-]/g, "").slice(0, 20) || "profil";
      let username = base;
      for (let i = 2; i < 50; i++) {
        const taken = await prisma.user.findUnique({ where: { username }, select: { id: true } });
        if (!taken) break;
        username = `${base}${i}`;
      }

      await prisma.user.create({
        data: {
          email,
          username,
          name: (profile?.name as string | undefined) ?? user.name ?? base,
          passwordHash: null,
          role: "freemium",
        },
      });
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        const typed = user as { role?: string; username?: string | null };
        if (typed.role) token.role = typed.role;
        if (typed.username) token.username = typed.username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const target = session.user as { role?: string; username?: string };
        target.role = (token.role as string) ?? "freemium";
        if (token.username as string | undefined) target.username = token.username as string;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };