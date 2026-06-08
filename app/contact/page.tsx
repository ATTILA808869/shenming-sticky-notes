import Image from "next/image";
import { ExternalLink, MessageCircle } from "lucide-react";
import { getContactContent } from "@/lib/storefront-data";

const mapUrl = "https://maps.app.goo.gl/f7tfewvAZ6Lf1e1q6";
const embedUrl = "https://www.google.com/maps?q=%E7%A5%9E%E6%98%8E%E4%BE%BF%E5%88%A9%E8%B2%BC&output=embed";
const lineUrl = "https://lin.ee/uUvBHxK";

export default async function ContactPage() {
  const contact = await getContactContent();
  return (
    <main className="container grid gap-10 py-12 lg:grid-cols-[1fr_0.9fr]">
      <section>
        <p className="text-sm font-black text-temple-red">Contact</p>
        <h1 className="mt-2 text-4xl font-black md:text-5xl">{contact?.title ?? "聯絡我們"}</h1>
        <p className="mt-4 text-xl font-semibold leading-8 text-neutral-700">{contact?.subtitle}</p>
        <div className="mt-6 whitespace-pre-line rounded-lg border border-orange-100 bg-white p-6 leading-8 shadow-soft">{contact?.body}</div>
        <section className="mt-6 rounded-lg border border-orange-100 bg-white p-6 shadow-soft">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-md bg-[#06C755] text-white">
              <MessageCircle size={22} />
            </span>
            <div>
              <h2 className="text-xl font-black">加入官方 LINE</h2>
              <p className="mt-1 text-sm text-neutral-600">掃描 QR Code 或點擊按鈕，直接與我們聯繫。</p>
            </div>
          </div>
          <a href={lineUrl} target="_blank" rel="noopener noreferrer" className="mx-auto mt-6 block max-w-xs overflow-hidden rounded-lg border border-green-100 bg-white p-4 transition hover:shadow-soft">
            <Image
              src="/images/official-line-qrcode.png"
              alt="神明便利貼官方 LINE QR Code"
              width={512}
              height={512}
              className="h-auto w-full"
              priority
            />
          </a>
          <a href={lineUrl} target="_blank" rel="noopener noreferrer" className="btn-primary mt-5 w-fit bg-[#06C755] hover:bg-green-600">
            前往官方 LINE
            <ExternalLink size={18} />
          </a>
        </section>
      </section>

      <section className="overflow-hidden rounded-lg border border-orange-100 bg-white shadow-soft">
        <div className="relative aspect-square bg-temple-cream">
          <iframe
            src={embedUrl}
            title="神明便利貼 Google Map"
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="absolute inset-0" aria-label="開啟 Google Maps 導航" />
        </div>
        <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between gap-3 border-t border-orange-100 p-4">
          <div>
            <h2 className="font-black">查看地圖與導航</h2>
            <p className="mt-1 text-sm text-neutral-600">點擊開啟 Google Maps。</p>
          </div>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-temple-red text-white transition group-hover:bg-red-600">
            <ExternalLink size={18} />
          </span>
        </a>
      </section>
    </main>
  );
}
