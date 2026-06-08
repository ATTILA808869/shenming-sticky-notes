import Link from "next/link";
import { Home } from "lucide-react";

export function FloatingHomeButton() {
  return (
    <Link
      href="/"
      className="fixed bottom-5 right-4 z-50 inline-flex h-12 items-center gap-2 rounded-full bg-temple-red px-4 text-sm font-black text-white shadow-soft transition hover:bg-red-600 sm:bottom-6 sm:right-6"
      aria-label="回到首頁"
    >
      <Home size={18} />
      <span>回到首頁</span>
    </Link>
  );
}
