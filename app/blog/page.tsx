import Image from "next/image";
import Link from "next/link";
import { SectionTitle } from "@/components/SectionTitle";
import { getPosts } from "@/lib/storefront-data";

export default async function BlogPage() {
  const posts = await getPosts();
  return (
    <main className="container py-12">
      <SectionTitle eyebrow="Blog" title="網誌／部落格" body="品牌故事、神明小知識、文具使用靈感，還有一些很懂上班族的吐槽。" />
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {posts.map((post) => (
          <Link key={post.id} href={`/blog/${post.slug}`} className="temple-card overflow-hidden">
            <div className="relative h-52">
              <Image src={post.coverUrl ?? "https://placehold.co/900x600/FFF8ED/2E2A27/png?text=Blog"} alt={post.title} fill className="object-cover" />
            </div>
            <div className="p-5">
              <h2 className="line-clamp-2 text-xl font-black">{post.title}</h2>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-neutral-600">{post.excerpt}</p>
              <p className="mt-4 text-sm font-bold text-temple-red">閱讀文章</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
