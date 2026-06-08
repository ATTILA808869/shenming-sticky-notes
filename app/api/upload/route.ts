import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 });

  if (file.size > 1_500_000) {
    return NextResponse.json({ error: "Image is too large. Please use an image under 1.5MB." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const dataUrl = `data:${file.type || "image/png"};base64,${bytes.toString("base64")}`;
  return NextResponse.json({ url: dataUrl });
}
