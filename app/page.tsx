import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { getHomeContent } from "@/lib/storefront-data";

export default async function HomePage() {
  const home = await getHomeContent();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "神明便利貼",
    url: "https://shenming-sticky-notes.vercel.app",
    logo: "https://shenming-sticky-notes.vercel.app/images/brand-logo.png",
    description: "台灣味 Q 版神明文創品牌，提供便利貼、貼紙與文創設計。",
    sameAs: ["https://www.instagram.com/shenming_note/"]
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <section className="container grid min-h-[auto] items-center gap-8 py-8 sm:py-12 lg:min-h-[620px] lg:grid-cols-[1fr_0.85fr] lg:gap-10">
        <div className="order-1">
          <div className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-temple-red shadow-sm sm:mb-5 sm:px-4 sm:text-sm">
            <BadgeCheck size={16} className="shrink-0" />
            <span className="truncate">原來神明也能這麼Q</span>
          </div>
          <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-normal text-temple-ink sm:text-5xl md:text-6xl lg:text-7xl">
            {home?.title ?? "神明便利貼"}
          </h1>
          <p className="mt-4 max-w-2xl text-lg font-semibold leading-8 text-neutral-700 sm:mt-5 sm:text-xl">
            {home?.subtitle ?? "讓信仰圍繞在你的生活。"}
          </p>
          <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-600">{home?.body}</p>
          <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
            <Link href="https://www.instagram.com/shenming_note/" target="_blank" rel="noopener noreferrer" className="btn-primary py-3">
              前往官方Instagram
              <ArrowRight size={18} />
            </Link>
            <Link href="/about" className="btn-secondary py-3">看品牌故事</Link>
          </div>
        </div>
        <div className="order-2">
          <div className="relative mx-auto aspect-square w-full max-w-[560px] overflow-hidden rounded-lg border border-orange-100 bg-white shadow-soft lg:max-w-none">
            <Image
              src={home?.imageUrl ?? "https://placehold.co/900x900/FFE2CF/2E2A27/png?text=God+Notes"}
              alt="神明便利貼品牌主視覺"
              fill
              priority
              className="object-cover"
            />
          </div>
        </div>
      </section>
      <section className="container pb-12 sm:pb-16">
        <div className="grid items-center gap-6 rounded-lg border border-orange-100 bg-white p-5 shadow-soft sm:p-6 lg:grid-cols-[0.9fr_1.1fr] lg:p-8">
          <div>
            <p className="text-sm font-black text-temple-red">LINE Stickers</p>
            <h2 className="mt-2 text-2xl font-black leading-tight text-temple-ink sm:text-3xl">眾神群聊 LINE 貼圖上架</h2>
            <p className="mt-4 max-w-xl text-base leading-8 text-neutral-700">
              把 Q 版神明帶進聊天日常，拜託、保庇、已讀不回都能可愛表達。
            </p>
            <Link href="https://store.line.me/stickershop/author/2905643/zh-Hant" target="_blank" rel="noopener noreferrer" className="btn-primary mt-6 inline-flex py-3">
              前往下載
              <ArrowRight size={18} />
            </Link>
          </div>
          <Link href="https://store.line.me/stickershop/author/2905643/zh-Hant" target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-orange-100 bg-white">
            <div className="relative mx-auto aspect-[303/290] w-full max-w-[420px]">
              <Image
                src="/images/line-sticker-zhongshen-cover.png"
                alt="眾神群聊 LINE 貼圖下載頁面"
                fill
                className="object-contain"
              />
            </div>
          </Link>
        </div>
      </section>
    </main>
  );
}
