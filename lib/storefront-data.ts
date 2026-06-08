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
  const categories = await prisma.category.findMany({ orderBy: { createdAt: "asc" } }).catch(() => []);
  return categories.length > 0 ? categories : demoCategories;
}

export async function getCategoriesWithCounts() {
  const categories = await prisma.category
    .findMany({ include: { _count: { select: { products: true } } }, orderBy: { createdAt: "asc" } })
    .catch(() => []);
  if (categories.length > 0) return categories;
  return demoCategories.map((category) => ({
    ...category,
    _count: { products: demoProducts.filter((product) => product.categoryId === category.id).length }
  }));
}

export async function getProducts() {
  const products = await prisma.product.findMany({ include: { category: true }, orderBy: { createdAt: "desc" } }).catch(() => []);
  return products.length > 0 ? products : demoProducts;
}

export async function getPopularProducts() {
  const products = await prisma.product.findMany({ include: { category: true }, orderBy: { soldCount: "desc" }, take: 8 }).catch(() => []);
  return products.length > 0 ? products : [...demoProducts].sort((a, b) => b.soldCount - a.soldCount);
}

export async function getProductBySlug(slug: string) {
  const product = await prisma.product.findUnique({ where: { slug }, include: { category: true } }).catch(() => null);
  return product ?? demoProducts.find((item) => item.slug === slug) ?? null;
}

export async function getRelatedProducts(categoryId: string, productId: string) {
  const products = await prisma.product
    .findMany({ where: { categoryId, NOT: { id: productId } }, include: { category: true }, take: 4 })
    .catch(() => []);
  return products.length > 0 ? products : demoProducts.filter((item) => item.categoryId === categoryId && item.id !== productId).slice(0, 4);
}

export async function getCategoryBySlug(slug: string) {
  const category = await prisma.category
    .findUnique({ where: { slug }, include: { products: { include: { category: true }, orderBy: { createdAt: "desc" } } } })
    .catch(() => null);
  if (category) return category;
  const fallback = demoCategories.find((item) => item.slug === slug);
  if (!fallback) return null;
  return {
    ...fallback,
    products: demoProducts.filter((product) => product.categoryId === fallback.id)
  };
}

export async function getPosts(take?: number) {
  const posts = await prisma.post.findMany({ where: { published: true }, orderBy: { createdAt: "desc" }, take }).catch(() => []);
  return posts.length > 0 ? posts : demoPosts.slice(0, take ?? demoPosts.length);
}

export async function getPostBySlug(slug: string) {
  const post = await prisma.post.findUnique({ where: { slug } }).catch(() => null);
  return post ?? demoPosts.find((item) => item.slug === slug) ?? null;
}
