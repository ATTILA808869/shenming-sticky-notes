import { deleteCategory, deletePost, saveCategory, savePost, updateSiteContent } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { ImageField } from "@/components/ImageField";
import { demoCategories, demoContents, demoPosts } from "@/lib/demo-data";

function Field({ name, label, defaultValue = "", type = "text" }: { name: string; label: string; defaultValue?: string | number | null; type?: string }) {
  return (
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      <input className="input" name={name} type={type} defaultValue={defaultValue ?? ""} />
    </label>
  );
}

function TextArea({ name, label, defaultValue = "" }: { name: string; label: string; defaultValue?: string | null }) {
  return (
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      <textarea className="input min-h-28" name={name} defaultValue={defaultValue ?? ""} />
    </label>
  );
}

export default async function AdminPage() {
  const [contents, categories, posts] = await Promise.all([
    prisma.siteContent.findMany({ orderBy: { key: "asc" } }).catch(() => Object.values(demoContents)),
    prisma.category.findMany({ orderBy: { createdAt: "asc" } }).catch(() => demoCategories),
    prisma.post.findMany({ orderBy: { updatedAt: "desc" } }).catch(() => demoPosts)
  ]);

  return (
    <main className="container py-10">
      <div className="mb-8">
        <p className="text-sm font-black text-temple-red">CMS Admin</p>
        <h1 className="mt-2 text-4xl font-black">神明便利貼形象網站後台</h1>
        <p className="mt-3 text-neutral-600">管理首頁內容、關於我們、聯絡資訊、商品類別與文章布告。</p>
      </div>

      <div className="grid gap-8">
        <section className="temple-card p-6">
          <h2 className="text-2xl font-black">網站內容</h2>
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            {contents.map((content) => (
              <form key={content.id} action={updateSiteContent} className="grid gap-3 rounded-lg border border-orange-100 p-4">
                <input type="hidden" name="key" value={content.key} />
                <Field name="title" label={`${content.key} 標題`} defaultValue={content.title} />
                <Field name="subtitle" label="副標" defaultValue={content.subtitle} />
                <TextArea name="body" label="內容" defaultValue={content.body} />
                <ImageField name="imageUrl" label="圖片" defaultValue={content.imageUrl} />
                <button className="btn-primary w-fit">儲存內容</button>
              </form>
            ))}
          </div>
        </section>

        <section className="temple-card p-6">
          <h2 className="text-2xl font-black">商品類別管理</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">這裡用來管理形象網站中的商品系列、服務分類或主題分類，不包含購物車與訂單功能。</p>
          <form action={saveCategory} className="mt-5 grid gap-3 rounded-lg bg-temple-cream p-4 md:grid-cols-2">
            <Field name="name" label="類別名稱" />
            <Field name="slug" label="網址代稱" />
            <TextArea name="description" label="類別介紹" />
            <ImageField name="imageUrl" label="類別圖片" />
            <button className="btn-primary w-fit">新增類別</button>
          </form>
          <div className="mt-5 grid gap-3">
            {categories.map((category) => (
              <form key={category.id} action={saveCategory} className="grid gap-3 rounded-lg border border-orange-100 p-4 lg:grid-cols-5">
                <input type="hidden" name="id" value={category.id} />
                <Field name="name" label="名稱" defaultValue={category.name} />
                <Field name="slug" label="Slug" defaultValue={category.slug} />
                <Field name="description" label="介紹" defaultValue={category.description} />
                <ImageField name="imageUrl" label="圖片" defaultValue={category.imageUrl} />
                <div className="flex items-end gap-2">
                  <button className="btn-primary">儲存</button>
                  <button formAction={deleteCategory} className="btn-secondary" type="submit">刪除</button>
                </div>
              </form>
            ))}
          </div>
        </section>

        <section className="temple-card p-6">
          <h2 className="text-2xl font-black">文章布告管理</h2>
          <form action={savePost} className="mt-5 grid gap-3 rounded-lg bg-temple-cream p-4 md:grid-cols-2">
            <Field name="title" label="文章標題" />
            <Field name="slug" label="網址代稱" />
            <Field name="excerpt" label="摘要" />
            <ImageField name="coverUrl" label="封面圖片" />
            <TextArea name="content" label="內文" />
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="published" defaultChecked /> 發布</label>
            <button className="btn-primary w-fit">新增文章</button>
          </form>
          <div className="mt-5 grid gap-3">
            {posts.map((post) => (
              <form key={post.id} action={savePost} className="grid gap-3 rounded-lg border border-orange-100 p-4 lg:grid-cols-3">
                <input type="hidden" name="id" value={post.id} />
                <Field name="title" label="標題" defaultValue={post.title} />
                <Field name="slug" label="Slug" defaultValue={post.slug} />
                <Field name="excerpt" label="摘要" defaultValue={post.excerpt} />
                <ImageField name="coverUrl" label="封面" defaultValue={post.coverUrl} />
                <TextArea name="content" label="內文" defaultValue={post.content} />
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="published" defaultChecked={post.published} /> 發布</label>
                  <button className="btn-primary">儲存</button>
                  <button formAction={deletePost} className="btn-secondary" type="submit">刪除</button>
                </div>
              </form>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
