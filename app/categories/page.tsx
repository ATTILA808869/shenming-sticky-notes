import Image from "next/image";
import Link from "next/link";
import { SectionTitle } from "@/components/SectionTitle";
import { getCategoriesWithCounts } from "@/lib/storefront-data";

export default async function CategoriesPage() {
  const categories = await getCategoriesWithCounts();
  return (
    <main className="container py-12">
      <SectionTitle eyebrow="Categories" title="商品大分類" body="先說出你的願望，再讓神明便利貼幫你整理今日任務。" />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {categories.map((category) => (
          <Link key={category.id} href={`/categories/${category.slug}`} className="temple-card overflow-hidden">
            <div className="relative h-56">
              <Image src={category.imageUrl ?? "https://placehold.co/900x600/FFF1B8/2E2A27/png?text=分類"} alt={category.name} fill className="object-cover" />
            </div>
            <div className="p-5">
              <h2 className="text-2xl font-black">{category.name}</h2>
              <p className="mt-2 leading-7 text-neutral-600">{category.description}</p>
              <p className="mt-4 font-bold text-temple-red">{category._count.products} 件商品</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
