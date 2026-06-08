import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { currency, splitList } from "@/lib/format";

type ProductCardProps = {
  product: {
    name: string;
    slug: string;
    price: number;
    salePrice: number | null;
    soldCount: number;
    rating: number;
    tags: string;
    images: string;
    category?: { name: string } | null;
  };
};

export function ProductCard({ product }: ProductCardProps) {
  const images = splitList(product.images);
  const tags = splitList(product.tags);
  const displayPrice = product.salePrice ?? product.price;
  return (
    <Link href={`/products/${product.slug}`} className="group temple-card block overflow-hidden transition hover:-translate-y-1 hover:border-temple-gold">
      <div className="relative aspect-square bg-temple-peach">
        <Image
          src={images[0] ?? "https://placehold.co/900x900/FFE2CF/2E2A27/png?text=神明便利貼"}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition group-hover:scale-105"
        />
        {product.salePrice ? (
          <span className="absolute right-2 top-2 rounded-md bg-temple-gold px-2 py-1 text-xs font-black text-temple-ink">
            折扣
          </span>
        ) : null}
      </div>
      <div className="grid gap-2 p-3">
        <div className="line-clamp-2 min-h-10 text-sm font-semibold leading-5">{product.name}</div>
        <div className="flex items-end gap-2">
          <span className="text-lg font-black text-temple-red">{currency(displayPrice)}</span>
          {product.salePrice ? <span className="text-xs text-neutral-400 line-through">{currency(product.price)}</span> : null}
        </div>
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>已售 {product.soldCount.toLocaleString("zh-TW")}</span>
          <span className="flex items-center gap-1 text-temple-gold">
            <Star size={14} fill="currentColor" />
            {product.rating.toFixed(1)}
          </span>
        </div>
        <div className="flex min-h-6 flex-wrap gap-1">
          {tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-sm border border-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-temple-red">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
