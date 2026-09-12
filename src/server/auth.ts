import { cookies } from "next/headers";
import { LANGUAGE_KEY } from "../lib/language";
import { registerOAuthUser } from "./registration";
import type { NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import { scryptSync, timingSafeEqual, randomBytes } from "node:crypto";
import { sql, rateLimit } from "./db";
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
function checkPassword(password: string, hash: string) {
  try {
    const [salt, h] = hash.split(":");
    const expected = Buffer.from(h, "hex");
    const actual = scryptSync(password, salt, 64);
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  } catch {
    return false;
  }
}
const providers: NextAuthOptions["providers"] = [];
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET)
  providers.push(
    Apple({
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET,
    }),
  );
providers.push(
  Credentials({
    name: "Private demo",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials, req) {
      const email = credentials?.email?.trim().toLowerCase() || "",
        password = credentials?.password || "";
      const ip = String(req.headers?.["x-forwarded-for"] || "local")
        .split(",")[0]
        .trim();
      if (
        !rateLimit("login-global", 100, 60) ||
        !rateLimit("login-ip:" + ip, 20, 600) ||
        !rateLimit("login:" + email, 8, 600)
      )
        return null;
      const u = sql
        .prepare(
          "SELECT * FROM users WHERE email=? AND is_demo=1 AND disabled=0",
        )
        .get(email) as any;
      const valid = checkPassword(
        password.slice(0, 1024),
        u?.password_hash ||
          "00000000000000000000000000000000:" + "0".repeat(128),
      );
      return u && valid ? { id: u.id, name: u.name, email: u.email } : null;
    },
  }),
);
export const authOptions: NextAuthOptions = {
  providers,
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 7 * 86400 },
  pages: { signIn: "/workspace" },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "credentials") return true;
      if (!account || !user.email) return false;
      if (
        account.provider === "google" &&
        (profile as any)?.email_verified !== true
      )
        return false;
      const existing = sql
        .prepare(
          "SELECT user_id FROM identities WHERE provider=? AND subject=?",
        )
        .get(account.provider, account.providerAccountId) as any;
      if (existing) {
        user.id = existing.user_id;
        return true;
      }
      // Never implicitly link an OAuth identity to an existing email account.
      if (
        sql
          .prepare("SELECT id FROM users WHERE email=?")
          .get(user.email.toLowerCase())
      )
        return "/workspace?error=accountLink";
      const preference = (await cookies()).get(LANGUAGE_KEY)?.value;
      const id = registerOAuthUser(
        user.email,
        user.name || "Explorer",
        account.provider,
        account.providerAccountId,
        preference,
      );
      user.id = id;
      return true;
    },
    async jwt({ token, user }) {
      if (user) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as any).id = token.uid;
      return session;
    },
  },
};
