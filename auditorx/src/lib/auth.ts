import { randomUUID } from "node:crypto";
import NextAuth, { type NextAuthConfig } from "next-auth";
import type { Adapter, AdapterAccount, AdapterUser, VerificationToken } from "next-auth/adapters";
import type { Provider } from "next-auth/providers";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { secret } from "./session";
import { MOCK, store, storeReady } from "./store";

/* ── Adaptador mínimo sobre el almacén ──────────────────────────────────── */

type StoredUser = Omit<AdapterUser, "emailVerified"> & { emailVerified: string | null };

const revive = (u: StoredUser | null): AdapterUser | null =>
  u ? { ...u, emailVerified: u.emailVerified ? new Date(u.emailVerified) : null } : null;

const keys = {
  user: (id: string) => `au:user:${id}`,
  email: (email: string) => `au:email:${email.toLowerCase()}`,
  account: (provider: string, id: string) => `au:acct:${provider}:${id}`,
  token: (identifier: string, token: string) => `au:vt:${identifier}:${token}`,
};

async function saveUser(user: AdapterUser): Promise<AdapterUser> {
  const stored: StoredUser = { ...user, emailVerified: user.emailVerified?.toISOString() ?? null };
  await store.set(keys.user(user.id), stored);
  await store.set(keys.email(user.email), user.id);
  return user;
}

async function userByEmail(email: string): Promise<AdapterUser | null> {
  const id = await store.get<string>(keys.email(email));
  return id ? revive(await store.get<StoredUser>(keys.user(id))) : null;
}

const adapter: Adapter = {
  createUser: (data) => saveUser({ ...data, id: randomUUID() }),
  getUser: async (id) => revive(await store.get<StoredUser>(keys.user(id))),
  getUserByEmail: userByEmail,
  async getUserByAccount({ provider, providerAccountId }) {
    const id = await store.get<string>(keys.account(provider, providerAccountId));
    return id ? revive(await store.get<StoredUser>(keys.user(id))) : null;
  },
  async updateUser(data) {
    const current = revive(await store.get<StoredUser>(keys.user(data.id)));
    if (!current) throw new Error("Usuario no encontrado");
    return saveUser({ ...current, ...data });
  },
  async linkAccount(account: AdapterAccount) {
    await store.set(keys.account(account.provider, account.providerAccountId), account.userId);
  },
  async createVerificationToken(vt: VerificationToken) {
    const ttl = Math.max(60, Math.ceil((vt.expires.getTime() - Date.now()) / 1000));
    await store.set(keys.token(vt.identifier, vt.token), { ...vt, expires: vt.expires.toISOString() }, { ex: ttl });
    return vt;
  },
  async useVerificationToken({ identifier, token }) {
    const vt = await store.getdel<{ identifier: string; token: string; expires: string }>(
      keys.token(identifier, token),
    );
    return vt ? { ...vt, expires: new Date(vt.expires) } : null;
  },
};

/* ── Proveedores: cada uno se activa solo si tiene sus variables ────────── */

export type ProviderId = "google" | "apple" | "github" | "email" | "demo";

const env = process.env;
const providers: Provider[] = [];
const enabled: ProviderId[] = [];

// Google, Apple y GitHub verifican el correo, así que es seguro unir en una
// sola cuenta a quien entra por dos vías con la misma dirección.
if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
  providers.push(Google({ allowDangerousEmailAccountLinking: true }));
  enabled.push("google");
}
if (env.AUTH_APPLE_ID && env.AUTH_APPLE_SECRET) {
  providers.push(Apple({ allowDangerousEmailAccountLinking: true }));
  enabled.push("apple");
}
if (env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET) {
  providers.push(GitHub({ allowDangerousEmailAccountLinking: true }));
  enabled.push("github");
}
if (env.AUTH_RESEND_KEY && env.AUTH_EMAIL_FROM) {
  // Enlace mágico por correo: sin contraseñas que guardar.
  providers.push(Resend({ id: "email", apiKey: env.AUTH_RESEND_KEY, from: env.AUTH_EMAIL_FROM }));
  enabled.push("email");
}
if (MOCK) {
  // Solo para probar la interfaz: entra con cualquier correo, sin verificar.
  providers.push(
    Credentials({
      id: "demo",
      credentials: { email: {} },
      async authorize(c) {
        const email = String(c.email ?? "").trim().toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(email)) return null;
        return (await userByEmail(email)) ?? saveUser({ id: randomUUID(), email, emailVerified: null });
      },
    }),
  );
  enabled.push("demo");
}

/** Proveedores disponibles; vacío si falta el almacén o no hay ninguno configurado. */
export const authProviders: ProviderId[] = storeReady ? enabled : [];

const config: NextAuthConfig = {
  adapter,
  providers,
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/", error: "/", verifyRequest: "/?login=sent" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
};

// Configuración perezosa: el secreto se lee en cada petición, no al compilar.
export const { handlers, auth } = NextAuth(() => ({ ...config, secret: secret() }));

export type AuthUser = { id: string; email: string; name?: string | null };

export async function currentUser(): Promise<AuthUser | null> {
  if (authProviders.length === 0) return null;
  const session = await auth();
  const u = session?.user;
  return u?.id && u.email ? { id: u.id, email: u.email, name: u.name } : null;
}
