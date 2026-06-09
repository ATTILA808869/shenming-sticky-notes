import Image from "next/image";
import Link from "next/link";
import { getAboutContent } from "@/lib/storefront-data";

export default async function AboutPage() {
  const about = await getAboutContent();
  return (
    <main className="container grid gap-8 py-8 sm:py-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
      <div className="relative mx-auto aspect-[4/5] w-full max-w-[460px] overflow-hidden rounded-lg border border-orange-100 bg-white shadow-soft lg:max-w-none">
        <Image src={about?.imageUrl ?? "https://placehold.co/900x900/FFF8ED/2E2A27/png?text=關於我們"} alt="關於神明便利貼" fill className="object-cover" />
      </div>
      <article className="self-center">
        <h1 className="mt-2 text-4xl font-black leading-tight md:text-5xl">{about?.title ?? "關於神明便利貼"}</h1>
        <p className="mt-4 text-lg font-semibold leading-8 text-neutral-700 sm:text-xl">{about?.subtitle}</p>
        <div className="mt-5 whitespace-pre-line text-base leading-8 text-neutral-600 sm:mt-6 sm:text-lg sm:leading-9">{about?.body}</div>
        <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
          <Link href="https://www.instagram.com/shenming_note/" target="_blank" rel="noopener noreferrer" className="btn-primary py-3">
            前往神明便利貼IG
          </Link>
          <Link href="https://www.instagram.com/chen.chen.star/" target="_blank" rel="noopener noreferrer" className="btn-secondary py-3">
            前往溱鋐設計IG
          </Link>
        </div>
      </article>
    </main>
  );
}
