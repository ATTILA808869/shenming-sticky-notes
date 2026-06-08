import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "神明便利貼",
  description: "神明便利貼品牌形象網站",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body className="min-h-screen text-temple-ink antialiased">
        <header className="sticky top-0 z-40 border-b border-orange-100 bg-white/92 backdrop-blur">
          <div className="container flex h-16 items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2 font-black tracking-normal text-temple-red">
              <Image src="/images/brand-logo.png" alt="神明便利貼 LOGO" width={40} height={40} className="h-10 w-10 rounded-md object-contain" priority />
              <span className="text-lg">神明便利貼</span>
            </Link>
            <nav className="hidden items-center gap-5 text-sm font-semibold md:flex">
              <Link href="/about">關於我們</Link>
              <Link href="/blog">文章布告</Link>
              <Link href="/categories">商品類別</Link>
              <Link href="/contact">聯絡我們</Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="mt-16 border-t border-orange-100 bg-white">
          <div className="container grid gap-8 py-10 md:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="text-xl font-black text-temple-red">神明便利貼</div>
              <p className="mt-3 max-w-md text-sm leading-7 text-neutral-600">
                把台灣民間信仰的祝福，變成書桌上每天都用得到的小小文創。
              </p>
            </div>
            <div className="text-sm leading-8 text-neutral-700 md:text-right">
              IG神明便利貼<br />
              官方LINE @509nbhbb<br />
              客服時間 周一至周五 10:00~18:00<br />
              信箱 amy191933@gmail.com
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
