import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { promisify } from "node:util";
import { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const gamePath = "/games/nezha";
export const cookieName = "nezha_session";
export const sessionSeconds = 7 * 24 * 60 * 60;

const derive = promisify(scrypt) as (password: string, salt: string, length: number) => Promise<Buffer>;
const dummySalt = randomBytes(16).toString("hex");
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export class GameError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function gameSession(request: NextRequest) {
  const token = request.cookies.get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;

  return prisma.nezhaSession.findFirst({
    where: { token: digest(token), expiresAt: { gt: new Date() } },
    select: { token: true, account: { select: { id: true, nickname: true } } }
  });
}

export async function limitAttempts(key: string, limit: number) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60_000);
  const [row] = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "NezhaRateLimit" ("key", "count", "expiresAt")
    VALUES (${digest(key)}, 1, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "NezhaRateLimit"."expiresAt" <= ${now} THEN 1
        ELSE LEAST("NezhaRateLimit"."count" + 1, ${limit + 1}) END,
      "expiresAt" = CASE WHEN "NezhaRateLimit"."expiresAt" <= ${now} THEN EXCLUDED."expiresAt"
        ELSE "NezhaRateLimit"."expiresAt" END
    RETURNING "count"
  `;
  return row.count > limit;
}

export async function authenticate(
  request: NextRequest,
  data: Record<string, unknown>,
  registering: boolean
) {
  const username = typeof data.username === "string" ? data.username.trim().toLowerCase() : "";
  const password = typeof data.password === "string" ? data.password : "";
  if (!/^[a-z0-9_]{3,24}$/.test(username) || password.length < 8 || password.length > 128) {
    throw new GameError(400, "帳號須為 3～24 個英數字或底線，密碼須為 8～128 個字元。");
  }
  if (registering && password !== data.confirm) {
    throw new GameError(400, "兩次輸入的密碼不同。");
  }

  const ip = process.env.VERCEL ? request.headers.get("x-vercel-forwarded-for")?.trim() : undefined;
  if ((ip && isIP(ip) && await limitAttempts(`ip:${ip}`, 15)) ||
      await limitAttempts(`account:${username}`, 8)) {
    throw new GameError(429, "嘗試次數過多，請稍後再試。");
  }

  if (randomInt(128) === 0) {
    const now = new Date();
    await Promise.all([
      prisma.nezhaRateLimit.deleteMany({ where: { expiresAt: { lte: now } } }),
      prisma.nezhaSession.deleteMany({ where: { expiresAt: { lte: now } } })
    ]);
  }

  const token = randomBytes(32).toString("hex");
  const session = {
    token: digest(token),
    expiresAt: new Date(Date.now() + sessionSeconds * 1000)
  };
  const existing = await gameSession(request);
  const account = await prisma.nezhaAccount.findUnique({ where: { username } });

  if (registering) {
    if (account) throw new GameError(409, "這個帳號已有人使用。");

    const salt = randomBytes(16).toString("hex");
    const passwordHash = (await derive(password, salt, 64)).toString("hex");
    try {
      await prisma.$transaction(async (tx) => {
        await tx.nezhaAccount.create({
          data: { username, salt, passwordHash, sessions: { create: session } }
        });
        if (existing) await tx.nezhaSession.deleteMany({ where: { token: existing.token } });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new GameError(409, "這個帳號已有人使用。");
      }
      throw error;
    }
    return { token, nickname: null };
  }

  const hash = await derive(password, account?.salt ?? dummySalt, 64);
  if (!account || !timingSafeEqual(hash, Buffer.from(account.passwordHash, "hex"))) {
    throw new GameError(401, "帳號或密碼不正確。");
  }

  await prisma.$transaction(async (tx) => {
    await tx.nezhaSession.create({ data: { ...session, accountId: account.id } });
    await tx.nezhaSession.deleteMany({
      where: {
        OR: [
          { accountId: account.id, expiresAt: { lte: new Date() } },
          ...(existing ? [{ token: existing.token }] : [])
        ]
      }
    });
  });
  return { token, nickname: account.nickname };
}
