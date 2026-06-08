import { deleteCategory, deletePost, deleteProduct, saveCategory, savePost, saveProduct, updateOrderStatus, updateSiteContent } from "@/lib/actions";
import { currency } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { ImageField } from "@/components/ImageField";

const statusLabels: Record<string, string> = {
  PENDING: "待處理",
  PAID: "已付款",
  PACKING: "備貨中",
  SHIPPED: "已出貨",
  COMPLETED: "已完成",
  CANCELLED: "已取消"
};

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
  const [contents, categories, posts, products, orders] = await Promise.all([
    prisma.siteContent.findMany({ orderBy: { key: "asc" } }),
    prisma.category.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.post.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.product.findMany({ include: { category: true }, orderBy: { updatedAt: "desc" } }),
    prisma.order.findMany({ include: { items: true }, orderBy: { createdAt: "desc" } })
  ]);

  return (
    <main className="container py-10">
      <div className="mb-8">
        <p className="text-sm font-black text-temple-red">CMS Admin</p>
        <h1 className="mt-2 text-4xl font-black">神明便利貼管理後台</h1>
        <p className="mt-3 text-neutral-600">管理首頁內容、關於我們、文章、商品、分類、圖片與訂單狀態。</p>
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
          <h2 className="text-2xl font-black">商品分類管理</h2>
          <form action={saveCategory} className="mt-5 grid gap-3 rounded-lg bg-temple-cream p-4 md:grid-cols-2">
            <Field name="name" label="分類名稱" />
            <Field name="slug" label="網址代稱" />
            <TextArea name="description" label="分類描述" />
            <ImageField name="imageUrl" label="分類圖片" />
            <button className="btn-primary w-fit">新增分類</button>
          </form>
          <div className="mt-5 grid gap-3">
            {categories.map((category) => (
              <form key={category.id} action={saveCategory} className="grid gap-3 rounded-lg border border-orange-100 p-4 lg:grid-cols-5">
                <input type="hidden" name="id" value={category.id} />
                <Field name="name" label="名稱" defaultValue={category.name} />
                <Field name="slug" label="Slug" defaultValue={category.slug} />
                <Field name="description" label="描述" defaultValue={category.description} />
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
          <h2 className="text-2xl font-black">部落格文章</h2>
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

        <section className="temple-card p-6">
          <h2 className="text-2xl font-black">商品管理</h2>
          <form action={saveProduct} className="mt-5 grid gap-3 rounded-lg bg-temple-cream p-4 md:grid-cols-2 lg:grid-cols-3">
            <Field name="name" label="商品名稱" />
            <Field name="slug" label="網址代稱" />
            <label className="grid gap-2 text-sm font-semibold">分類<select className="input" name="categoryId">{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <Field name="price" label="原價" type="number" defaultValue={0} />
            <Field name="salePrice" label="折扣價" type="number" />
            <Field name="soldCount" label="銷量" type="number" defaultValue={0} />
            <Field name="rating" label="評價星等" type="number" defaultValue={5} />
            <Field name="tags" label="標籤，逗號分隔" />
            <Field name="specs" label="規格，逗號分隔" />
            <ImageField name="images" label="商品圖片，上傳一張或填多張逗號分隔" />
            <TextArea name="description" label="商品介紹" />
            <button className="btn-primary w-fit">新增商品</button>
          </form>
          <div className="mt-5 grid gap-3">
            {products.map((product) => (
              <form key={product.id} action={saveProduct} className="grid gap-3 rounded-lg border border-orange-100 p-4 lg:grid-cols-4">
                <input type="hidden" name="id" value={product.id} />
                <Field name="name" label="商品名稱" defaultValue={product.name} />
                <Field name="slug" label="Slug" defaultValue={product.slug} />
                <label className="grid gap-2 text-sm font-semibold">分類<select className="input" name="categoryId" defaultValue={product.categoryId}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                <Field name="price" label="原價" type="number" defaultValue={product.price} />
                <Field name="salePrice" label="折扣價" type="number" defaultValue={product.salePrice} />
                <Field name="soldCount" label="銷量" type="number" defaultValue={product.soldCount} />
                <Field name="rating" label="星等" type="number" defaultValue={product.rating} />
                <Field name="tags" label="標籤" defaultValue={product.tags} />
                <Field name="specs" label="規格" defaultValue={product.specs} />
                <ImageField name="images" label="圖片網址，逗號分隔" defaultValue={product.images} />
                <TextArea name="description" label="介紹" defaultValue={product.description} />
                <div className="flex items-end gap-2">
                  <button className="btn-primary">儲存</button>
                  <button formAction={deleteProduct} className="btn-secondary" type="submit">刪除</button>
                </div>
              </form>
            ))}
          </div>
        </section>

        <section className="temple-card p-6">
          <h2 className="text-2xl font-black">訂單管理</h2>
          <div className="mt-5 grid gap-4">
            {orders.map((order) => (
              <div key={order.id} className="rounded-lg border border-orange-100 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="font-black">{order.customer} · {currency(order.total)}</h3>
                    <p className="mt-1 text-sm text-neutral-600">{order.email} / {order.phone}</p>
                    <p className="mt-1 text-sm text-neutral-600">{order.address}</p>
                  </div>
                  <form action={updateOrderStatus} className="flex gap-2">
                    <input type="hidden" name="id" value={order.id} />
                    <select className="input" name="status" defaultValue={order.status}>
                      {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <button className="btn-primary">更新</button>
                  </form>
                </div>
                <div className="mt-3 grid gap-1 text-sm text-neutral-600">
                  {order.items.map((item) => <span key={item.id}>{item.name} / {item.spec ?? "一般款"} x {item.quantity}</span>)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
