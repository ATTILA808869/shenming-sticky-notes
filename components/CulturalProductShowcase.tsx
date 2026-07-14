import Image from "next/image";

const productImages = [
  { src: "/images/shenming-watching-tee-01.jpg", alt: "神明有在看棉T黑色款式一" },
  { src: "/images/shenming-watching-tee-02.jpg", alt: "神明有在看棉T黑色款式二" },
  { src: "/images/shenming-watching-tee-03.jpg", alt: "神明有在看棉T關公款" },
  { src: "/images/shenming-watching-tee-04.jpg", alt: "神明有在看棉T灰色款" }
];

const productVideos = [
  { src: "/videos/shenming-watching-tee-video-01.mp4", title: "神明有在看棉T影片 1" },
  { src: "/videos/shenming-watching-tee-video-02.mp4", title: "神明有在看棉T影片 2" }
];

export function CulturalProductShowcase() {
  return (
    <section className="container pb-12 sm:pb-16">
      <div className="rounded-lg border border-orange-100 bg-white p-5 shadow-soft sm:p-6 lg:p-8">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <p className="text-sm font-black text-temple-red">Creative Goods</p>
            <h2 className="mt-2 text-2xl font-black leading-tight text-temple-ink sm:text-3xl">
              神明有在看 棉T
            </h2>
            <p className="mt-4 max-w-xl text-base leading-8 text-neutral-700">
              不能做壞事要乖乖，因為「神明有在看」
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-black text-temple-red">
              <span className="rounded-full bg-temple-cream px-3 py-1.5">文創商品</span>
              <span className="rounded-full bg-temple-cream px-3 py-1.5">棉T</span>
              <span className="rounded-full bg-temple-cream px-3 py-1.5">神明有在看</span>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {productImages.map((image) => (
                <div key={image.src} className="relative aspect-square overflow-hidden rounded-lg border border-orange-100 bg-temple-cream">
                  <Image src={image.src} alt={image.alt} fill sizes="(min-width: 1024px) 30vw, 90vw" className="object-cover" />
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {productVideos.map((video) => (
                <div key={video.src} className="overflow-hidden rounded-lg border border-orange-100 bg-black">
                  <video
                    src={video.src}
                    title={video.title}
                    controls
                    muted
                    playsInline
                    preload="metadata"
                    className="aspect-video w-full bg-black object-contain"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
