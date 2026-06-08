import Image from "next/image";
import { prisma } from "@/lib/prisma";

export default async function AboutPage() {
  const about = await prisma.siteContent.findUnique({ where: { key: "about" } }).catch(() => null);
  return (
    <main className="container grid gap-10 py-12 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="relative aspect-square overflow-hidden rounded-lg border border-orange-100 bg-white shadow-soft">
        <Image src={about?.imageUrl ?? "https://placehold.co/900x900/FFF8ED/2E2A27/png?text=關於我們"} alt="關於神明便利貼" fill className="object-cover" />
      </div>
      <article className="self-center">
        <p className="text-sm font-black text-temple-red">About</p>
        <h1 className="mt-2 text-4xl font-black md:text-5xl">{about?.title ?? "關於神明便利貼"}</h1>
        <p className="mt-4 text-xl font-semibold leading-8 text-neutral-700">{about?.subtitle}</p>
        <div className="mt-6 whitespace-pre-line text-lg leading-9 text-neutral-600">{about?.body}</div>
      </article>
    </main>
  );
}
