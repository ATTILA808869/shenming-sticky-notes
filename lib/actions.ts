"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/format";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const int = (formData: FormData, key: string) => Number.parseInt(text(formData, key) || "0", 10);
const maybeInt = (formData: FormData, key: string) => {
  const value = text(formData, key);
  return value ? Number.parseInt(value, 10) : null;
};

export async function updateSiteContent(formData: FormData) {
  const key = text(formData, "key");
  await prisma.siteContent.upsert({
    where: { key },
    update: {
      title: text(formData, "title"),
      subtitle: text(formData, "subtitle"),
      body: text(formData, "body"),
      imageUrl: text(formData, "imageUrl")
    },
    create: {
      key,
      title: text(formData, "title"),
      subtitle: text(formData, "subtitle"),
      body: text(formData, "body"),
      imageUrl: text(formData, "imageUrl")
    }
  });
  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/contact");
  revalidatePath("/admin");
}

export async function saveCategory(formData: FormData) {
  const id = text(formData, "id");
  const name = text(formData, "name");
  const data = {
    name,
    slug: text(formData, "slug") || slugify(name),
    description: text(formData, "description"),
    imageUrl: text(formData, "imageUrl")
  };
  if (id) await prisma.category.update({ where: { id }, data });
  else await prisma.category.create({ data });
  revalidatePath("/", "layout");
}

export async function deleteCategory(formData: FormData) {
  await prisma.category.delete({ where: { id: text(formData, "id") } });
  revalidatePath("/", "layout");
}

export async function savePost(formData: FormData) {
  const id = text(formData, "id");
  const title = text(formData, "title");
  const data = {
    title,
    slug: text(formData, "slug") || slugify(title),
    excerpt: text(formData, "excerpt"),
    content: text(formData, "content"),
    coverUrl: text(formData, "coverUrl"),
    published: formData.get("published") === "on"
  };
  if (id) await prisma.post.update({ where: { id }, data });
  else await prisma.post.create({ data });
  revalidatePath("/blog");
  revalidatePath("/admin");
}

export async function deletePost(formData: FormData) {
  await prisma.post.delete({ where: { id: text(formData, "id") } });
  revalidatePath("/blog");
  revalidatePath("/admin");
}

export async function saveProduct(formData: FormData) {
  const id = text(formData, "id");
  const name = text(formData, "name");
  const data = {
    name,
    slug: text(formData, "slug") || slugify(name),
    description: text(formData, "description"),
    price: int(formData, "price"),
    salePrice: maybeInt(formData, "salePrice"),
    soldCount: int(formData, "soldCount"),
    rating: Number.parseFloat(text(formData, "rating") || "5"),
    tags: text(formData, "tags"),
    images: text(formData, "images"),
    specs: text(formData, "specs"),
    categoryId: text(formData, "categoryId")
  };
  if (id) await prisma.product.update({ where: { id }, data });
  else await prisma.product.create({ data });
  revalidatePath("/", "layout");
}

export async function deleteProduct(formData: FormData) {
  await prisma.product.delete({ where: { id: text(formData, "id") } });
  revalidatePath("/", "layout");
}

export async function updateOrderStatus(formData: FormData) {
  await prisma.order.update({
    where: { id: text(formData, "id") },
    data: { status: text(formData, "status") }
  });
  revalidatePath("/admin");
}

const checkoutSchema = z.object({
  customer: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(6),
  address: z.string().min(5),
  note: z.string().optional(),
  items: z
    .string()
    .transform((value) => JSON.parse(value) as Array<{ id: string; name: string; price: number; quantity: number; spec?: string }>)
});

export async function createOrder(formData: FormData) {
  const payload = checkoutSchema.parse({
    customer: text(formData, "customer"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    address: text(formData, "address"),
    note: text(formData, "note"),
    items: text(formData, "items")
  });
  const subtotal = payload.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingFee = subtotal >= 999 ? 0 : 60;
  await prisma.order
    .create({
      data: {
        customer: payload.customer,
        email: payload.email,
        phone: payload.phone,
        address: payload.address,
        note: payload.note,
        subtotal,
        shippingFee,
        total: subtotal + shippingFee,
        items: {
          create: payload.items.map((item) => ({
            productId: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            spec: item.spec
          }))
        }
      }
    })
    .catch(() => null);
  revalidatePath("/admin");
  redirect("/checkout/success");
}
