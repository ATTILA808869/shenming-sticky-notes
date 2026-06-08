import Image from "next/image";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { AddToCart } from "@/components/AddToCart";
import { ProductCard } from "@/components/ProductCard";
import { currency, splitList } from "@/lib/format";
import { getProductBySlug, getRelatedProducts } from "@/lib/storefront-data";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const images = splitList(product.images);
  const tags = splitList(product.tags);
  const related = await getRelatedProducts(product.categoryId, product.id);

  return (
    <main className="container py-12">
      <section className="grid gap-10 lg:grid-cols-[1fr_0.9fr]">
        <div className="grid gap-4">
          <div className="relative aspect-square overflow-hidden rounded-lg border border-orange-100 bg-white shadow-soft">
            <Image
              src={images[0] ?? "https://placehold.co/900x900/FFE2CF/2E2A27/png?text=Product"}
              alt={product.name}
              fill
              priority
              className="object-cover"
            />
          </div>
          <div className="grid grid-cols-4 gap-3">
            {images.slice(0, 4).map((image) => (
              <div key={image} className="relative aspect-square overflow-hidden rounded-md border border-orange-100 bg-white">
                <Image src={image} alt={product.name} fill className="object-cover" />
              </div>
            ))}
          </div>
        </div>

        <section className="temple-card self-start p-6">
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="rounded-sm border border-red-100 px-2 py-1 text-xs font-bold text-temple-red">
                {tag}
              </span>
            ))}
          </div>
          <h1 className="mt-4 text-3xl font-black leading-tight md:text-4xl">{product.name}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-neutral-600">
            <span className="flex items-center gap-1 text-temple-gold">
              <Star size={16} fill="currentColor" /> {product.rating.toFixed(1)}
            </span>
            <span>已售 {product.soldCount.toLocaleString("zh-TW")}</span>
            <span>{product.category.name}</span>
          </div>
          <div className="mt-6 rounded-lg bg-temple-cream p-5">
            <span className="text-3xl font-black text-temple-red">{currency(product.salePrice ?? product.price)}</span>
            {product.salePrice ? <span className="ml-3 text-neutral-400 line-through">{currency(product.price)}</span> : null}
          </div>
          <p className="mt-6 leading-8 text-neutral-700">{product.description}</p>
          <div className="mt-6">
            <AddToCart product={product} />
          </div>
        </section>
      </section>

      {related.length > 0 ? (
        <section className="mt-16">
          <h2 className="mb-6 text-2xl font-black">同分類推薦</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
