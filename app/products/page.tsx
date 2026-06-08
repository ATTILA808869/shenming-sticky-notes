import { ProductCard } from "@/components/ProductCard";
import { SectionTitle } from "@/components/SectionTitle";
import { getProducts } from "@/lib/storefront-data";

export default async function ProductsPage() {
  const products = await getProducts();
  return (
    <main className="container py-12">
      <SectionTitle eyebrow="Shop" title="全部商品" body="照願望挑，照心情貼。每張便利貼都有一點台灣味和一點神明幽默。" />
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {products.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>
    </main>
  );
}
