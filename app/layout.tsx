import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FloatingHomeButton } from "@/components/FloatingHomeButton";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://shenming-sticky-notes.vercel.app"),
  title: {
    default: "神明便利貼｜Q 版神明文創便利貼與貼紙",
    template: "%s｜神明便利貼"
  },
  description: "神明便利貼是台灣味 Q 版神明文創品牌，提供可愛保庇感的便利貼、貼紙與文創設計，讓信仰陪伴日常生活。",
  keywords: ["神明便利貼", "Q版神明", "神明貼紙", "文創便利貼", "台灣文創", "民間信仰文創"],
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "神明便利貼｜Q 版神明文創便利貼與貼紙",
    description: "台灣味 Q 版神明文創品牌，讓信仰陪伴你的生活。",
    url: "https://shenming-sticky-notes.vercel.app",
    siteName: "神明便利貼",
    locale: "zh_TW",
    type: "website",
    images: [
      {
        url: "/images/brand-logo.png",
        width: 512,
        height: 512,
        alt: "神明便利貼品牌 Logo"
      }
    ]
  },
  twitter: {
    card: "summary",
    title: "神明便利貼｜Q 版神明文創便利貼與貼紙",
    description: "台灣味 Q 版神明文創品牌，讓信仰陪伴你的生活。",
    images: ["/images/brand-logo.png"]
  },
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png"
  }
};

const navItems = [
  { href: "/about", label: "關於我們" },
  { href: "/blog", label: "文章布告" },
  { href: "/categories", label: "商品類別" },
  { href: "/contact", label: "聯絡我們" }
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body className="min-h-screen pb-20 text-temple-ink antialiased sm:pb-24">
        <header className="sticky top-0 z-40 border-b border-orange-100 bg-white/94 backdrop-blur">
          <div className="container flex min-h-16 flex-col gap-3 py-3 md:h-16 md:flex-row md:items-center md:justify-between md:gap-4 md:py-0">
            <Link href="/" className="flex items-center gap-2 font-black tracking-normal text-temple-red">
              <Image src="/images/brand-logo.png" alt="神明便利貼 LOGO" width={40} height={40} className="h-10 w-10 rounded-md object-contain" priority />
              <span className="text-lg">神明便利貼</span>
            </Link>
            <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 text-sm font-semibold md:mx-0 md:gap-5 md:overflow-visible md:px-0 md:pb-0">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className="shrink-0 rounded-full bg-temple-cream px-3 py-1.5 transition hover:bg-temple-peach md:bg-transparent md:px-0 md:py-0">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        {children}
        <footer className="mt-12 border-t border-orange-100 bg-white sm:mt-16">
          <div className="container grid gap-6 py-8 sm:py-10 md:grid-cols-[1.1fr_0.9fr]">
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
        <FloatingHomeButton />
      </body>
    </html>
  );
}
