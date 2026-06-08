"use client";

import { useEffect, useMemo, useState } from "react";
import { createOrder } from "@/lib/actions";
import { currency } from "@/lib/format";

type CartItem = { id: string; name: string; price: number; spec?: string; quantity: number };
const key = "god-note-cart";

export default function CheckoutPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => setItems(JSON.parse(localStorage.getItem(key) ?? "[]")), []);
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);
  const shippingFee = subtotal >= 999 ? 0 : 60;
  return (
    <main className="container py-12">
      <h1 className="text-4xl font-black">結帳</h1>
      <form action={createOrder} className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="temple-card grid gap-4 p-6">
          <h2 className="text-xl font-black">收件資料</h2>
          <input className="input" name="customer" placeholder="收件人姓名" required />
          <input className="input" name="email" type="email" placeholder="Email" required />
          <input className="input" name="phone" placeholder="手機" required />
          <input className="input" name="address" placeholder="收件地址" required />
          <textarea className="input min-h-28" name="note" placeholder="備註，例如希望放哪款祝福小卡" />
          <input type="hidden" name="items" value={JSON.stringify(items)} />
          <button className="btn-primary w-fit py-3" disabled={items.length === 0}>送出訂單</button>
        </section>
        <aside className="temple-card h-fit p-6">
          <h2 className="text-xl font-black">訂單明細</h2>
          <div className="mt-4 grid gap-3 text-sm">
            {items.map((item) => (
              <div key={`${item.id}-${item.spec}`} className="flex justify-between gap-3">
                <span>{item.name} x {item.quantity}</span>
                <strong>{currency(item.price * item.quantity)}</strong>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-3 border-t border-orange-100 pt-4 text-sm">
            <div className="flex justify-between"><span>小計</span><strong>{currency(subtotal)}</strong></div>
            <div className="flex justify-between"><span>運費</span><strong>{shippingFee === 0 ? "免運" : currency(shippingFee)}</strong></div>
            <div className="flex justify-between text-lg"><span>總金額</span><strong className="text-temple-red">{currency(subtotal + shippingFee)}</strong></div>
          </div>
        </aside>
      </form>
    </main>
  );
}
