import Link from "next/link";
import { ClearCart } from "./ClearCart";

export default function CheckoutSuccessPage() {
  return (
    <main className="container py-16">
      <ClearCart />
      <div className="mx-auto max-w-xl rounded-lg border border-orange-100 bg-white p-10 text-center shadow-soft">
        <p className="text-sm font-black text-temple-red">Order Sent</p>
        <h1 className="mt-2 text-4xl font-black">訂單已送出</h1>
        <p className="mt-4 leading-7 text-neutral-600">神明便利貼已收到你的願望清單，後台可以查看並修改訂單狀態。</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/products" className="btn-secondary">繼續逛逛</Link>
          <Link href="/admin" className="btn-primary">查看後台</Link>
        </div>
      </div>
    </main>
  );
}
