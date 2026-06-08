import Image from "next/image";
import Link from "next/link";
import { SectionTitle } from "@/components/SectionTitle";
import { getCategoriesWithCounts } from "@/lib/storefront-data";

export default async function CategoriesPage() {
  const categories = await getCategoriesWithCounts();
  return (
    <main className="container py-8 sm:py-12">
      <SectionTitle eyebrow="Categories" title="商品類別" body="瀏覽神明便利貼目前提供的商品系列。" />
      {categories.length === 0 ? (
        <div className="mt-8 rounded-lg border border-orange-100 bg-white p-10 text-center shadow-soft">
          <p className="text-lg font-bold">目前尚無商品類別</p>
          <p className="mt-2 text-sm text-neutral-600">你可以到後台新增類別，發布後就會顯示在這裡。</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Link key={category.id} href={`/categories/${category.slug}`} className="group temple-card overflow-hidden transition hover:-translate-y-1 hover:border-temple-gold">
              <div className="relative aspect-square bg-temple-cream">
                <Image
                  src={category.imageUrl ?? "https://placehold.co/900x900/FFF1B8/2E2A27/png?text=Category"}
                  alt={category.name}
                  fill
                  className="object-cover transition group-hover:scale-105"
                />
              </div>
              <div className="p-4 text-center sm:p-5">
                <h2 className="text-xl font-black sm:text-2xl">{category.name}</h2>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
