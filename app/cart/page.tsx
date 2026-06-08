"use client";

import Image from "next/image";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { currency } from "@/lib/format";

type CartItem = { id: string; slug: string; name: string; price: number; image: string; spec?: string; quantity: number };
const key = "god-note-cart";

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => setItems(JSON.parse(localStorage.getItem(key) ?? "[]")), []);
  const save = (next: CartItem[]) => {
    setItems(next);
    localStorage.setItem(key, JSON.stringify(next));
  };
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);
  return (
    <main className="container py-12">
      <h1 className="text-4xl font-black">購物車</h1>
      {items.length === 0 ? (
        <div className="mt-8 rounded-lg border border-orange-100 bg-white p-10 text-center shadow-soft">
          <p className="text-lg font-bold">購物車目前是空的</p>
          <Link href="/products" className="btn-primary mt-5">去逛商品</Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-3">
            {items.map((item) => (
              <div key={`${item.id}-${item.spec}`} className="temple-card grid gap-4 p-4 sm:grid-cols-[112px_1fr_auto]">
                <div className="relative aspect-square overflow-hidden rounded-md bg-temple-peach">
                  <Image src={item.image} alt={item.name} fill className="object-cover" />
                </div>
                <div>
                  <Link href={`/products/${item.slug}`} className="font-black">{item.name}</Link>
                  <p className="mt-2 text-sm text-neutral-500">規格：{item.spec || "一般款"}</p>
                  <p className="mt-3 font-black text-temple-red">{currency(item.price)}</p>
                </div>
                <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                  <div className="inline-flex overflow-hidden rounded-md border border-orange-200">
                    <button className="px-3 py-1" onClick={() => save(items.map((next) => next === item ? { ...next, quantity: Math.max(1, next.quantity - 1) } : next))}>-</button>
                    <span className="w-10 py-1 text-center font-bold">{item.quantity}</span>
                    <button className="px-3 py-1" onClick={() => save(items.map((next) => next === item ? { ...next, quantity: next.quantity + 1 } : next))}>+</button>
                  </div>
                  <button className="text-neutral-400 hover:text-temple-red" onClick={() => save(items.filter((next) => next !== item))} aria-label="刪除商品">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <aside className="temple-card h-fit p-6">
            <h2 className="text-xl font-black">訂單摘要</h2>
            <div className="mt-5 grid gap-3 text-sm">
              <div className="flex justify-between"><span>小計</span><strong>{currency(subtotal)}</strong></div>
              <div className="flex justify-between"><span>運費</span><strong>{subtotal >= 999 ? "免運" : currency(60)}</strong></div>
              <div className="border-t border-orange-100 pt-3 flex justify-between text-lg"><span>總金額</span><strong className="text-temple-red">{currency(subtotal + (subtotal >= 999 ? 0 : 60))}</strong></div>
            </div>
            <Link href="/checkout" className="btn-primary mt-6 w-full py-3">前往結帳</Link>
          </aside>
        </div>
      )}
    </main>
  );
}
