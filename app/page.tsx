import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { getHomeContent } from "@/lib/storefront-data";

export default async function HomePage() {
  const home = await getHomeContent();

  return (
    <main>
      <section className="container grid min-h-[620px] items-center gap-10 py-10 lg:grid-cols-[1fr_0.85fr]">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-temple-red shadow-sm">
            <BadgeCheck size={16} />
            台灣味 Q 版神明文具店
          </div>
          <h1 className="max-w-3xl text-5xl font-black leading-tight tracking-normal text-temple-ink md:text-7xl">
            {home?.title ?? "神明便利貼"}
          </h1>
          <p className="mt-5 max-w-2xl text-xl font-semibold leading-8 text-neutral-700">
            {home?.subtitle ?? "讓信仰圍繞在你的生活。"}
          </p>
          <p className="mt-4 max-w-2xl leading-7 text-neutral-600">{home?.body}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="https://www.instagram.com/shenming_note/" target="_blank" rel="noopener noreferrer" className="btn-primary py-3">
              前往官方Instagram
              <ArrowRight size={18} />
            </Link>
            <Link href="/about" className="btn-secondary py-3">看品牌故事</Link>
          </div>
        </div>
        <div className="relative">
          <div className="relative aspect-square overflow-hidden rounded-lg border border-orange-100 bg-white shadow-soft">
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
    </main>
  );
}
