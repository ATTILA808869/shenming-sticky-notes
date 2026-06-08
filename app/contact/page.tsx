import Image from "next/image";
import { Send } from "lucide-react";
import { getContactContent } from "@/lib/storefront-data";

export default async function ContactPage() {
  const contact = await getContactContent();
  return (
    <main className="container grid gap-10 py-12 lg:grid-cols-[1fr_0.9fr]">
      <section>
        <p className="text-sm font-black text-temple-red">Contact</p>
        <h1 className="mt-2 text-4xl font-black md:text-5xl">{contact?.title ?? "聯絡我們"}</h1>
        <p className="mt-4 text-xl font-semibold leading-8 text-neutral-700">{contact?.subtitle}</p>
        <div className="mt-6 whitespace-pre-line rounded-lg border border-orange-100 bg-white p-6 leading-8 shadow-soft">{contact?.body}</div>
        <form className="mt-6 grid gap-4 rounded-lg border border-orange-100 bg-white p-6 shadow-soft">
          <input className="input" placeholder="姓名" />
          <input className="input" placeholder="Email" type="email" />
          <textarea className="input min-h-36" placeholder="想合作、客製或詢問商品，都可以寫在這裡。" />
          <button className="btn-primary w-fit" type="button">
            <Send size={18} />
            送出訊息
          </button>
        </form>
      </section>
      <div className="relative aspect-square overflow-hidden rounded-lg border border-orange-100 bg-white shadow-soft">
        <Image src={contact?.imageUrl ?? "https://placehold.co/900x900/D9F4EA/2E2A27/png?text=聯絡我們"} alt="聯絡我們" fill className="object-cover" />
      </div>
    </main>
  );
}
