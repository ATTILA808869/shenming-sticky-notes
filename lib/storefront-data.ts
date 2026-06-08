import { prisma } from "@/lib/prisma";
import { demoCategories, demoContents, demoPosts, demoProducts } from "@/lib/demo-data";

export async function getHomeContent() {
  return prisma.siteContent.findUnique({ where: { key: "home" } }).catch(() => demoContents.home);
}

export async function getAboutContent() {
  return prisma.siteContent.findUnique({ where: { key: "about" } }).catch(() => demoContents.about);
}

export async function getContactContent() {
  return prisma.siteContent.findUnique({ where: { key: "contact" } }).catch(() => demoContents.contact);
}

export async function getCategories() {
  return prisma.category.findMany({ orderBy: { createdAt: "asc" } }).catch(() => demoCategories);
}

export async function getCategoriesWithCounts() {
  return prisma.category
    .findMany({ include: { _count: { select: { products: true } } }, orderBy: { createdAt: "asc" } })
    .catch(() =>
      demoCategories.map((category) => ({
        ...category,
        _count: { products: demoProducts.filter((product) => product.categoryId === category.id).length }
      }))
    );
}

export async function getProducts() {
  return prisma.product.findMany({ include: { category: true }, orderBy: { createdAt: "desc" } }).catch(() => demoProducts);
}

export async function getPopularProducts() {
  return prisma
    .product
    .findMany({ include: { category: true }, orderBy: { soldCount: "desc" }, take: 8 })
    .catch(() => [...demoProducts].sort((a, b) => b.soldCount - a.soldCount));
}

export async function getProductBySlug(slug: string) {
  try {
    return await prisma.product.findUnique({ where: { slug }, include: { category: true } });
  } catch {
    return demoProducts.find((item) => item.slug === slug) ?? null;
  }
}

export async function getRelatedProducts(categoryId: string, productId: string) {
  return prisma.product
    .findMany({ where: { categoryId, NOT: { id: productId } }, include: { category: true }, take: 4 })
    .catch(() => demoProducts.filter((item) => item.categoryId === categoryId && item.id !== productId).slice(0, 4));
}

export async function getCategoryBySlug(slug: string) {
  try {
    return await prisma.category.findUnique({ where: { slug }, include: { products: { include: { category: true }, orderBy: { createdAt: "desc" } } } });
  } catch {
    const fallback = demoCategories.find((item) => item.slug === slug);
    if (!fallback) return null;
    return {
      ...fallback,
      products: demoProducts.filter((product) => product.categoryId === fallback.id)
    };
  }
}

export async function getPosts(take?: number) {
  return prisma.post.findMany({ where: { published: true }, orderBy: { createdAt: "desc" }, take }).catch(() => demoPosts.slice(0, take ?? demoPosts.length));
}

export async function getPostBySlug(slug: string) {
  try {
    return await prisma.post.findUnique({ where: { slug } });
  } catch {
    return demoPosts.find((item) => item.slug === slug) ?? null;
  }
}
