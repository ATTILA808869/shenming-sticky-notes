import { prisma } from "@/lib/prisma";
import { GameError } from "@/lib/nezha/session";

const maxImageBytes = 1024 * 1024;
export const billboardBodyLimit = Math.ceil(maxImageBytes / 3) * 4 + 8192;
const validId = /^[a-zA-Z0-9-]{1,48}$/;
const select = { id: true, title: true, kind: true, targetUrl: true, sortOrder: true, published: true, assetPath: true, imageType: true, updatedAt: true } as const;

export async function listBillboard(gm = false, params?: URLSearchParams) {
  const term = gm ? (params?.get("q") ?? "").trim().slice(0, 80) : "";
  const page = gm ? Math.max(1, Math.min(1000, Number.parseInt(params?.get("page") ?? "1", 10) || 1)) : 1;
  const size = gm ? 24 : 48;
  const rows = await prisma.nezhaBillboard.findMany({
    select,
    where: { deletedAt: null, ...(gm ? {} : { published: true }), ...(term ? { title: { contains: term, mode: "insensitive" } } : {}) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    skip: (page - 1) * size,
    take: size + 1
  });
  return { rows: rows.slice(0, size).map(({ assetPath, imageType, ...row }) => ({
    ...row,
    imageUrl: imageType ? `/games/nezha/${gm ? "gm/" : ""}api/billboard-image/${row.id}?v=${row.updatedAt.getTime()}` : assetPath
  })), more: rows.length > size };
}

function billboardLink(value: unknown) {
  try {
    if (typeof value !== "string" || value.length > 1024) throw new Error();
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.href.length > 1024) throw new Error();
    return url.href;
  } catch {
    throw new GameError(400, "請填寫完整的 HTTPS 點擊連結。");
  }
}

function billboardImage(value: unknown) {
  if (typeof value !== "string" || !value || value.length > billboardBodyLimit || value.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new GameError(400, "無法讀取圖片。");
  }
  const image = Buffer.from(value, "base64");
  if (image.length > maxImageBytes) throw new GameError(413, "圖片大小不得超過 1 MB。");
  let imageType: string | undefined;
  if (image.length >= 33 && image.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) && image.toString("ascii", 12, 16) === "IHDR") imageType = "image/png";
  if (image.length >= 16 && image.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))) imageType = "image/jpeg";
  if (image.length >= 16 && image.toString("ascii", 0, 4) === "RIFF" && image.toString("ascii", 8, 12) === "WEBP") imageType = "image/webp";
  if (!imageType) throw new GameError(400, "請上傳 PNG、JPG 或 WebP 圖片。");
  return { image: new Uint8Array(image), imageType, assetPath: null };
}

export async function updateBillboard(data: Record<string, unknown>) {
  const id = typeof data.id === "string" && validId.test(data.id) ? data.id : undefined;
  if (data.id !== undefined && !id) throw new GameError(400, "橫幅編號無效。");
  if (data.action === "save") {
    const title = typeof data.title === "string" ? data.title.trim() : "";
    const kind = data.kind;
    const sortOrder = data.sortOrder;
    if (!title || title.length > 70 || (kind !== "ad" && kind !== "notice") || typeof sortOrder !== "number" || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 999) {
      throw new GameError(400, "請確認標題、分類與排序（0 至 999）。");
    }
    const fields = { title, kind, sortOrder, targetUrl: billboardLink(data.targetUrl), ...(data.image === undefined ? {} : billboardImage(data.image)) };
    if (!id) {
      if (!fields.image) throw new GameError(400, "請上傳橫幅圖片。");
      await prisma.nezhaBillboard.create({ data: fields });
      return;
    }
    const result = await prisma.nezhaBillboard.updateMany({ where: { id, deletedAt: null }, data: fields });
    if (!result.count) throw new GameError(404, "此橫幅已不存在。");
    return;
  }
  if (!id || !["publish", "unpublish", "delete"].includes(String(data.action))) throw new GameError(400, "無效的橫幅操作。");
  const result = await prisma.nezhaBillboard.updateMany({
    where: { id, deletedAt: null },
    data: data.action === "delete" ? { published: false, deletedAt: new Date(), image: null, imageType: null, assetPath: null } : { published: data.action === "publish" }
  });
  if (!result.count) throw new GameError(404, "此橫幅已不存在。");
}

export async function readBillboardImage(id: string, gm: boolean) {
  const row = validId.test(id) ? await prisma.nezhaBillboard.findFirst({
    where: { id, deletedAt: null, ...(gm ? {} : { published: true }) }, select: { image: true, imageType: true }
  }) : null;
  if (!row?.image || !row.imageType) throw new GameError(404, "找不到橫幅圖片。");
  return new Response(new Uint8Array(row.image), { headers: {
    "Content-Type": row.imageType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox"
  } });
}
