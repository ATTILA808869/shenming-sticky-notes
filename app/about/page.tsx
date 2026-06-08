import Image from "next/image";
import { getAboutContent } from "@/lib/storefront-data";

export default async function AboutPage() {
  const about = await getAboutContent();
  return (
    <main className="container grid gap-8 py-8 sm:py-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
      <div className="relative mx-auto aspect-square w-full max-w-[560px] overflow-hidden rounded-lg border border-orange-100 bg-white shadow-soft lg:max-w-none">
        <Image src={about?.imageUrl ?? "https://placehold.co/900x900/FFF8ED/2E2A27/png?text=關於我們"} alt="關於神明便利貼" fill className="object-cover" />
      </div>
      <article className="self-center">
        <p className="text-sm font-black text-temple-red">About</p>
        <h1 className="mt-2 text-4xl font-black leading-tight md:text-5xl">{about?.title ?? "關於神明便利貼"}</h1>
        <p className="mt-4 text-lg font-semibold leading-8 text-neutral-700 sm:text-xl">{about?.subtitle}</p>
        <div className="mt-5 whitespace-pre-line text-base leading-8 text-neutral-600 sm:mt-6 sm:text-lg sm:leading-9">{about?.body}</div>
      </article>
    </main>
  );
}
