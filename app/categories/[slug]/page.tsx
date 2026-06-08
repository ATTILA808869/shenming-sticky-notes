import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { prisma } from "@/lib/prisma";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = await prisma.category.findUnique({
    where: { slug },
    include: { products: { include: { category: true }, orderBy: { createdAt: "desc" } } }
  });
  if (!category) notFound();
  return (
    <main className="container py-12">
      <p className="text-sm font-black text-temple-red">Category</p>
      <h1 className="mt-2 text-4xl font-black">{category.name}</h1>
      <p className="mt-3 max-w-2xl leading-7 text-neutral-600">{category.description}</p>
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {category.products.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>
    </main>
  );
}
