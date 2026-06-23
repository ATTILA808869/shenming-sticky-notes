"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const slides = [
  { src: "/images/birthday-reminder-01-huye.jpg", alt: "虎爺生日提醒" },
  { src: "/images/birthday-reminder-02-hanxiangzi.jpg", alt: "八仙韓湘子生日提醒" },
  { src: "/images/birthday-reminder-03-chifu.jpg", alt: "池府王爺生日提醒" },
  { src: "/images/birthday-reminder-04-guangong.jpg", alt: "關公生日提醒" },
  { src: "/images/birthday-reminder-05-taishanglaojun.jpg", alt: "太上老君生日提醒" },
  { src: "/images/birthday-reminder-06-qiniangma.jpg", alt: "七娘母生日提醒" }
];

export function HeroImageCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrent((index) => (index + 1) % slides.length);
    }, 3500);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[560px] overflow-hidden rounded-lg border border-orange-100 bg-white shadow-soft lg:max-w-none">
      {slides.map((slide, index) => (
        <Image
          key={slide.src}
          src={slide.src}
          alt={slide.alt}
          fill
          priority={index === 0}
          sizes="(min-width: 1024px) 45vw, 90vw"
          className={`object-cover transition-opacity duration-700 ${index === current ? "opacity-100" : "opacity-0"}`}
        />
      ))}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-white/80 px-3 py-2 shadow-sm backdrop-blur">
        {slides.map((slide, index) => (
          <button
            key={slide.src}
            type="button"
            aria-label={`切換到第 ${index + 1} 張生日提醒圖片`}
            onClick={() => setCurrent(index)}
            className={`h-2.5 w-2.5 rounded-full transition ${index === current ? "bg-temple-red" : "bg-orange-200 hover:bg-orange-300"}`}
          />
        ))}
      </div>
    </div>
  );
}
