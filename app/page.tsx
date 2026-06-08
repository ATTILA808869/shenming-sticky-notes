import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Gift, Laugh, Truck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/ProductCard";
import { SectionTitle } from "@/components/SectionTitle";

export default async function HomePage() {
  const [home, categories, products, posts] = await Promise.all([
    prisma.siteContent.findUnique({ where: { key: "home" } }).catch(() => null),
    prisma.category.findMany({ include: { _count: { select: { products: true } } }, orderBy: { createdAt: "asc" } }).catch(() => []),
    prisma.product.findMany({ include: { category: true }, orderBy: { soldCount: "desc" }, take: 8 }).catch(() => []),
    prisma.post.findMany({ where: { published: true }, orderBy: { createdAt: "desc" }, take: 3 }).catch(() => [])
  ]);

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
            {home?.subtitle ?? "把願望貼起來，讓 Q 版神明幫你盯進度。"}
          </p>
          <p className="mt-4 max-w-2xl leading-7 text-neutral-600">{home?.body}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/products" className="btn-primary py-3">
              逛商品
              <ArrowRight size={18} />
            </Link>
            <Link href="/about" className="btn-secondary py-3">看品牌故事</Link>
          </div>
        </div>
        <div className="relative">
          <div className="relative aspect-square overflow-hidden rounded-lg border border-orange-100 bg-white shadow-soft">
            <Image
              src={home?.imageUrl ?? "https://placehold.co/900x900/FFE2CF/2E2A27/png?text=神明便利貼"}
              alt="神明便利貼品牌主視覺"
              fill
              priority
              className="object-cover"
            />
          </div>
          <div className="absolute -bottom-5 left-6 right-6 rounded-lg bg-white p-4 shadow-soft">
            <div className="grid grid-cols-3 gap-3 text-center text-sm font-bold">
              <span>保庇待辦</span>
              <span>喜氣送禮</span>
              <span>上班不厭世</span>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="container grid gap-4 md:grid-cols-3">
          {[
            { title: "滿額免運", body: "NT$999 以上宅配免運", Icon: Truck },
            { title: "可愛保庇", body: "每款都有一句日常神明吐槽", Icon: Laugh },
            { title: "文創送禮", body: "適合朋友、同事、考生與自己", Icon: Gift }
          ].map(({ title, body, Icon }) => (
            <div key={title} className="flex items-start gap-4 rounded-lg border border-orange-100 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-temple-cream text-temple-red">
                <Icon size={22} />
              </span>
              <div>
                <h3 className="font-black">{title}</h3>
                <p className="mt-1 text-sm text-neutral-600">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <SectionTitle eyebrow="Categories" title="依照今日願望分類" body="招財、考試、戀愛，先選神明再寫待辦。" />
          <Link href="/categories" className="hidden font-bold text-temple-red md:block">全部分類</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {categories.map((category) => (
            <Link key={category.id} href={`/categories/${category.slug}`} className="temple-card overflow-hidden">
              <div className="relative h-48">
                <Image src={category.imageUrl ?? "https://placehold.co/900x600/FFF1B8/2E2A27/png?text=分類"} alt={category.name} fill className="object-cover" />
              </div>
              <div className="p-5">
                <h3 className="text-xl font-black">{category.name}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-600">{category.description}</p>
                <p className="mt-4 text-sm font-bold text-temple-red">{category._count.products} 件商品</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="container py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <SectionTitle eyebrow="Popular" title="大家最近都在拜託這些" body="熱賣款、送禮款、上班族精神續命款。" />
          <Link href="/products" className="hidden font-bold text-temple-red md:block">全部商品</Link>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {products.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      </section>

      <section className="container py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <SectionTitle eyebrow="Journal" title="保庇靈感筆記" body="品牌故事、使用提案，以及有點幽默的信仰日常。" />
          <Link href="/blog" className="hidden font-bold text-temple-red md:block">全部文章</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {posts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`} className="temple-card overflow-hidden">
              <div className="relative h-48">
                <Image src={post.coverUrl ?? "https://placehold.co/900x600/FFF8ED/2E2A27/png?text=Blog"} alt={post.title} fill className="object-cover" />
              </div>
              <div className="p-5">
                <h3 className="line-clamp-2 text-lg font-black">{post.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-600">{post.excerpt}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
