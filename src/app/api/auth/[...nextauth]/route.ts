import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GithubProvider from "next-auth/providers/github";

/**
 * Configuration NextAuth v4 — ParisCore.
 * Providers : Credentials (email/mdp) + Google + GitHub (optionnels).
 * Session : JWT (pas de DB adapter pour l'instant).
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
    // Toujours présent : login par email/mdp (mode démo)
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "email@example.com" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        // Mode démo : accepter tout email non vide avec password >= 4 chars
        // TODO: remplacer par vraie validation DB (Prisma + bcrypt)
        if (!credentials?.email || !credentials.password) return null;
        if (credentials.password.length < 4) return null;

        return {
          id: credentials.email,
          email: credentials.email,
          name: credentials.email.split("@")[0],
          role: "freemium",
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
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role ?? "freemium";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role =
          (token.role as string) ?? "freemium";
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
