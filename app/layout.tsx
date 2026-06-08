import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBag, Sparkles } from "lucide-react";
import "./globals.css";
import { getCategories } from "@/lib/storefront-data";

export const metadata: Metadata = {
  title: "神明便利貼",
  description: "可愛 Q 版神明文創便利貼品牌與購物網站"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const categories = await getCategories();
  return (
    <html lang="zh-Hant">
      <body className="min-h-screen text-temple-ink antialiased">
        <header className="sticky top-0 z-40 border-b border-orange-100 bg-white/92 backdrop-blur">
          <div className="container flex h-16 items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2 font-black tracking-normal text-temple-red">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-temple-red text-white">
                <Sparkles size={19} />
              </span>
              <span className="text-lg">神明便利貼</span>
            </Link>
            <nav className="hidden items-center gap-5 text-sm font-semibold md:flex">
              <Link href="/about">關於</Link>
              <Link href="/blog">網誌</Link>
              <Link href="/categories">分類</Link>
              <Link href="/products">商品</Link>
              <Link href="/contact">聯絡</Link>
              <Link href="/admin" className="text-temple-red">後台</Link>
            </nav>
            <Link href="/cart" className="btn-primary px-3">
              <ShoppingBag size={18} />
              購物車
            </Link>
          </div>
          {categories.length > 0 ? (
            <div className="border-t border-orange-50 bg-temple-cream/70">
              <div className="container flex gap-3 overflow-x-auto py-2 text-sm">
                {categories.map((category) => (
                  <Link key={category.id} href={`/categories/${category.slug}`} className="shrink-0 rounded-full bg-white px-3 py-1 font-medium text-temple-ink shadow-sm">
                    {category.name}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </header>
        {children}
        <footer className="mt-16 border-t border-orange-100 bg-white">
          <div className="container grid gap-8 py-10 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
            <div>
              <div className="text-xl font-black text-temple-red">神明便利貼</div>
              <p className="mt-3 max-w-md text-sm leading-7 text-neutral-600">
                把台灣民間信仰的祝福，變成書桌上每天都用得到的小小文創。
              </p>
            </div>
            <div className="grid gap-2 text-sm">
              <strong>逛逛</strong>
              <Link href="/products">全部商品</Link>
              <Link href="/blog">品牌網誌</Link>
              <Link href="/contact">聯絡我們</Link>
            </div>
            <div className="text-sm leading-7 text-neutral-600">
              免運門檻 NT$999<br />
              客服時間 10:00-18:00<br />
              hello@godnotes.tw
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
