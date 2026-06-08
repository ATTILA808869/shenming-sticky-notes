"use client";

import { useMemo, useState } from "react";
import { ShoppingCart, Zap } from "lucide-react";
import { useRouter } from "next/navigation";

type Product = {
  id: string;
  name: string;
  slug: string;
  price: number;
  salePrice: number | null;
  images: string;
  specs: string;
};

const key = "god-note-cart";

export function AddToCart({ product }: { product: Product }) {
  const router = useRouter();
  const specs = product.specs.split(",").map((item) => item.trim()).filter(Boolean);
  const [spec, setSpec] = useState(specs[0] ?? "");
  const [quantity, setQuantity] = useState(1);
  const item = useMemo(
    () => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.salePrice ?? product.price,
      image: product.images.split(",")[0],
      spec,
      quantity
    }),
    [product, quantity, spec]
  );

  const add = () => {
    const current = JSON.parse(localStorage.getItem(key) ?? "[]") as typeof item[];
    const index = current.findIndex((cartItem) => cartItem.id === item.id && cartItem.spec === item.spec);
    if (index >= 0) current[index].quantity += quantity;
    else current.push(item);
    localStorage.setItem(key, JSON.stringify(current));
    window.dispatchEvent(new Event("cart-updated"));
  };

  return (
    <div className="grid gap-5">
      {specs.length > 0 ? (
        <div>
          <div className="mb-2 text-sm font-bold">規格</div>
          <div className="flex flex-wrap gap-2">
            {specs.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSpec(option)}
                className={`rounded-md border px-4 py-2 text-sm font-semibold ${spec === option ? "border-temple-red bg-red-50 text-temple-red" : "border-orange-200 bg-white"}`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div>
        <div className="mb-2 text-sm font-bold">數量</div>
        <div className="inline-flex items-center overflow-hidden rounded-md border border-orange-200 bg-white">
          <button type="button" className="px-4 py-2 text-lg" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>-</button>
          <span className="w-12 text-center font-bold">{quantity}</span>
          <button type="button" className="px-4 py-2 text-lg" onClick={() => setQuantity((value) => value + 1)}>+</button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" className="btn-secondary py-3" onClick={add}>
          <ShoppingCart size={18} />
          加入購物車
        </button>
        <button
          type="button"
          className="btn-primary py-3"
          onClick={() => {
            add();
            router.push("/checkout");
          }}
        >
          <Zap size={18} />
          立即購買
        </button>
      </div>
    </div>
  );
}
