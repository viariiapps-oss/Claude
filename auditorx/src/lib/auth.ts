import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import NextAuth, { type NextAuthConfig } from "next-auth";
import type { Adapter, AdapterAccount, AdapterUser, VerificationToken } from "next-auth/adapters";
import type { Provider } from "next-auth/providers";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { secret } from "./session";
import { store, storeReady } from "./store";

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

/* ── Correo y contraseña ────────────────────────────────────────────────── */

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const pwKey = (email: string) => `au:pw:${email}`;
const failKey = (email: string) => `au:fail:${email}`;
const MAX_FAILS = 8;
const LOCK_SECONDS = 15 * 60;

export const MIN_PASSWORD = 8;
const normalize = (email: unknown) => String(email ?? "").trim().toLowerCase();
const validEmail = (email: string) => email.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `${salt.toString("base64")}:${hash.toString("base64")}`;
}

async function checkPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":").map((p) => Buffer.from(p, "base64"));
  const given = await scryptAsync(password, salt, hash.length);
  return timingSafeEqual(given, hash);
}

export class RegisterError extends Error {}

/**
 * Alta con correo y contraseña. Solo si ese correo no tiene ya una cuenta:
 * así nadie puede añadir una contraseña a la cuenta de otra persona.
 */
export async function registerUser(rawEmail: unknown, password: unknown): Promise<void> {
  const email = normalize(rawEmail);
  if (!validEmail(email)) throw new RegisterError("Ese correo no parece válido.");
  if (typeof password !== "string" || password.length < MIN_PASSWORD || password.length > 200) {
    throw new RegisterError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
  }
  if (await userByEmail(email)) {
    throw new RegisterError("Ya existe una cuenta con ese correo. Inicia sesión.");
  }
  await saveUser({ id: randomUUID(), email, emailVerified: null });
  await store.set(pwKey(email), await hashPassword(password));
}

async function passwordLogin(rawEmail: unknown, password: unknown): Promise<AdapterUser | null> {
  const email = normalize(rawEmail);
  if (!validEmail(email) || typeof password !== "string" || password.length > 200) return null;
  // Freno a la fuerza bruta: tras varios fallos, el correo queda bloqueado un rato.
  if (((await store.get<number>(failKey(email))) ?? 0) >= MAX_FAILS) return null;

  const stored = await store.get<string>(pwKey(email));
  const user = stored && (await checkPassword(password, stored)) ? await userByEmail(email) : null;
  if (!user) {
    if ((await store.incrby(failKey(email), 1)) === 1) await store.expire(failKey(email), LOCK_SECONDS);
    return null;
  }
  await store.del(failKey(email));
  return user;
}

/* ── Proveedores: cada uno se activa solo si tiene sus variables ────────── */

export type ProviderId = "password" | "google" | "apple" | "github" | "email";

const env = process.env;
const enabled: ProviderId[] = ["password"];
const providers: Provider[] = [
  Credentials({
    id: "password",
    credentials: { email: {}, password: {} },
    authorize: (c) => passwordLogin(c.email, c.password),
  }),
];

// Las cuentas no se unen solas por tener el mismo correo: una cuenta creada
// con contraseña no ha demostrado ser dueña de esa dirección. Quien intente
// entrar por otra vía con un correo ya registrado recibe un aviso.
if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
  providers.push(Google);
  enabled.push("google");
}
if (env.AUTH_APPLE_ID && env.AUTH_APPLE_SECRET) {
  providers.push(Apple);
  enabled.push("apple");
}
if (env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET) {
  providers.push(GitHub);
  enabled.push("github");
}
if (env.AUTH_RESEND_KEY && env.AUTH_EMAIL_FROM) {
  // Enlace mágico por correo: sirve también para entrar si olvidas la contraseña.
  providers.push(Resend({ id: "email", apiKey: env.AUTH_RESEND_KEY, from: env.AUTH_EMAIL_FROM }));
  enabled.push("email");
}

/** Proveedores disponibles; vacío si falta la base de datos. */
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
