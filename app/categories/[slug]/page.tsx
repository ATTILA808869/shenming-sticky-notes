import Image from "next/image";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { getCategoryBySlug } from "@/lib/storefront-data";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  return (
    <main className="container py-12">
      <section className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative aspect-square overflow-hidden rounded-lg border border-orange-100 bg-white shadow-soft">
          <Image
            src={category.imageUrl ?? "https://placehold.co/900x900/FFF1B8/2E2A27/png?text=Category"}
            alt={category.name}
            fill
            priority
            className="object-cover"
          />
        </div>
        <article className="self-center">
          <p className="text-sm font-black text-temple-red">Category</p>
          <h1 className="mt-2 text-4xl font-black md:text-5xl">{category.name}</h1>
          {category.description ? <p className="mt-4 text-xl font-semibold leading-8 text-neutral-700">{category.description}</p> : null}
          {category.content ? <div className="mt-6 whitespace-pre-line text-lg leading-9 text-neutral-600">{category.content}</div> : null}
          {category.purchaseUrl ? (
            <Link href={category.purchaseUrl} target="_blank" rel="noopener noreferrer" className="btn-primary mt-8 py-3">
              前往購買
              <ExternalLink size={18} />
            </Link>
          ) : null}
        </article>
      </section>
    </main>
  );
}
