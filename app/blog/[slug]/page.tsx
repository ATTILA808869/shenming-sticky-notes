import Image from "next/image";
import { notFound } from "next/navigation";
import { getPostBySlug } from "@/lib/storefront-data";

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post || !post.published) notFound();

  return (
    <main className="container max-w-4xl py-8 sm:py-12">
      <article className="overflow-hidden rounded-lg border border-orange-100 bg-white shadow-soft">
        <div className="relative aspect-[16/9]">
          <Image
            src={post.coverUrl ?? "https://placehold.co/1200x675/FFF8ED/2E2A27/png?text=Blog"}
            alt={post.title}
            fill
            className="object-cover"
          />
        </div>
        <div className="p-5 sm:p-6 md:p-10">
          <p className="text-sm font-black text-temple-red">{post.createdAt.toLocaleDateString("zh-TW")}</p>
          <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">{post.title}</h1>
          <p className="mt-4 text-lg font-semibold leading-8 text-neutral-700 sm:text-xl">{post.excerpt}</p>
          <div className="mt-6 whitespace-pre-line text-base leading-8 text-neutral-700 sm:mt-8 sm:text-lg sm:leading-9">{post.content}</div>
        </div>
      </article>
    </main>
  );
}
