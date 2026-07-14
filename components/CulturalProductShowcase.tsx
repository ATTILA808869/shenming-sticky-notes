"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

const productImages = [
  { src: "/images/shenming-watching-tee-01.jpg", alt: "神明有在看文創 T-SHIRT 黑色款式一" },
  { src: "/images/shenming-watching-tee-02.jpg", alt: "神明有在看文創 T-SHIRT 黑色款式二" },
  { src: "/images/shenming-watching-tee-03.jpg", alt: "神明有在看文創 T-SHIRT 關公款" },
  { src: "/images/shenming-watching-tee-04.jpg", alt: "神明有在看文創 T-SHIRT 灰色款" }
];

const purchaseUrl = "https://lin.ee/Po1DyM0";

export function CulturalProductShowcase() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrent((index) => (index + 1) % productImages.length);
    }, 3500);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="container pb-12 sm:pb-16">
      <div className="grid items-center gap-6 rounded-lg border border-orange-100 bg-white p-5 shadow-soft sm:p-6 lg:grid-cols-[0.9fr_1.1fr] lg:p-8">
        <div>
          <p className="text-sm font-black text-temple-red">Creative Goods</p>
          <h2 className="mt-2 text-2xl font-black leading-tight text-temple-ink sm:text-3xl">
            <span className="block">宗教也能很潮</span>
            <span className="block">「神明有在看文創 T-SHIRT」</span>
          </h2>
          <p className="mt-4 max-w-xl text-base leading-8 text-neutral-700">
            不能做壞事要乖乖，因為「神明有在看」
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-black text-temple-red">
            <span className="rounded-full bg-temple-cream px-3 py-1.5">文創商品</span>
            <span className="rounded-full bg-temple-cream px-3 py-1.5">T-SHIRT</span>
            <span className="rounded-full bg-temple-cream px-3 py-1.5">神明有在看</span>
          </div>
          <Link href={purchaseUrl} target="_blank" rel="noopener noreferrer" className="btn-primary mt-6 inline-flex py-3">
            至官方LINE預購
            <ArrowRight size={18} />
          </Link>
        </div>

        <div className="relative mx-auto aspect-[4/5] w-full max-w-[420px] overflow-hidden rounded-lg border border-orange-100 bg-white">
          {productImages.map((image, index) => (
            <Image
              key={image.src}
              src={image.src}
              alt={image.alt}
              fill
              sizes="(min-width: 1024px) 420px, 90vw"
              className={`object-contain transition-opacity duration-700 ${index === current ? "opacity-100" : "opacity-0"}`}
            />
          ))}
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-white/80 px-3 py-2 shadow-sm backdrop-blur">
            {productImages.map((image, index) => (
              <button
                key={image.src}
                type="button"
                aria-label={`切換到第 ${index + 1} 張衣服款式圖片`}
                onClick={() => setCurrent(index)}
                className={`h-2.5 w-2.5 rounded-full transition ${index === current ? "bg-temple-red" : "bg-orange-200 hover:bg-orange-300"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
