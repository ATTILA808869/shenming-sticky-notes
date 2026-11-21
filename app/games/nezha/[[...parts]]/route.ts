import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, cookieName, GameError, gamePath, gameSession, limitAttempts, sessionSeconds } from "@/lib/nezha/session";
import { getScores, saveScore } from "@/lib/nezha/scores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ parts?: string[] }> };

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff"
};

function json(data: object, status = 200) {
  return NextResponse.json(data, { status, headers: privateHeaders });
}

function errorResponse(error: unknown) {
  if (error instanceof GameError) return json({ error: error.message }, error.status);
  console.error("Nezha request failed:", error);
  return json({ error: "遊戲服務暫時無法使用，請稍後再試。" }, 503);
}

async function asset(name: "index.html" | "game.html" | "nezha.webp") {
  const bytes = await readFile(resolve(process.cwd(), "lib", "nezha", "assets", name));
  return new Response(new Uint8Array(bytes), {
    headers: {
      ...privateHeaders,
      "Content-Type": name.endsWith(".html") ? "text/html; charset=utf-8" : "image/webp",
      "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'"
    }
  });
}

function isHttps(request: NextRequest) {
  return process.env.VERCEL === "1" || request.nextUrl.protocol === "https:";
}

function setSessionCookie(response: NextResponse, request: NextRequest, token: string, maxAge: number) {
  response.cookies.set(cookieName, token, {
    path: gamePath,
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps(request),
    maxAge
  });
  return response;
}

async function readData(request: NextRequest): Promise<Record<string, unknown>> {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const expectedOrigin = `${isHttps(request) ? "https" : "http"}://${host}`;
  if (origin !== expectedOrigin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new GameError(403, "請從遊戲網站操作。");
  }
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
    throw new GameError(415, "請使用 JSON 格式。");
  }
  if (!request.body) throw new GameError(400, "資料格式錯誤。");

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let body = "";
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        throw new GameError(413, "資料太長。");
      }
      body += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body + decoder.decode());
  } catch {
    throw new GameError(400, "資料格式錯誤。");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new GameError(400, "資料格式錯誤。");
  }
  return parsed as Record<string, unknown>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const path = (await params).parts?.join("/") ?? "";
  try {
    switch (path) {
      case "":
        return await asset("index.html");
      case "game": {
        const session = await gameSession(request);
        if (session?.account.nickname) return await asset("game.html");

        return new Response(null, {
          status: 303,
          headers: { ...privateHeaders, Location: gamePath }
        });
      }
      case "nezha.webp":
        if ((await gameSession(request))?.account.nickname) return await asset("nezha.webp");
        break;
      case "api/session": {
        const session = await gameSession(request);
        return json({ authenticated: Boolean(session), nickname: session?.account.nickname ?? null });
      }
      case "api/leaderboard":
        if ((await gameSession(request))?.account.nickname) return json({ scores: await getScores() });
        break;
      default:
        return json({ error: "找不到頁面。" }, 404);
    }
    return json({ error: "請先登入。" }, 401);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const path = (await params).parts?.join("/");
  try {
    const data = await readData(request);
    if (path === "api/register" || path === "api/login") {
      const { token, nickname } = await authenticate(request, data, path === "api/register");
      return setSessionCookie(json({ nickname }), request, token, sessionSeconds);
    }

    const session = await gameSession(request);
    if (path === "api/logout") {
      if (session) await prisma.nezhaSession.deleteMany({ where: { token: session.token } });
      return setSessionCookie(json({ ok: true }), request, "", 0);
    }
    if (!session) throw new GameError(401, "請先登入。");

    const { account } = session;
    if (path === "api/nickname") {
      const nickname = typeof data.nickname === "string" ? data.nickname.trim().normalize("NFC") : "";
      if (!/^[\p{L}\p{N}_ -]{2,16}$/u.test(nickname)) {
        throw new GameError(400, "暱稱須為 2～16 個字，可用中文、英數字、空格、底線或連字號。");
      }
      const result = await prisma.nezhaAccount.updateMany({
        where: { id: account.id, nickname: null },
        data: { nickname }
      });
      if (result.count === 0) throw new GameError(409, "暱稱已設定。");
      return json({ nickname });
    }
    if (path === "api/score") {
      if (!account.nickname) throw new GameError(403, "請先設定暱稱。");
      if (await limitAttempts(`score:${account.id}`, 12)) {
        throw new GameError(429, "送出太頻繁，請稍後再試。");
      }
      return json({ updated: await saveScore(data, account.id) });
    }
    return json({ error: "找不到頁面。" }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}
