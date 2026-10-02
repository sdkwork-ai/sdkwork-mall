const { request } = require("./transport");

function mapProductCard(item) {
  return {
    id: String(item.id ?? item.spuId ?? ""),
    title: String(item.title ?? item.name ?? "商品"),
    imageUrl: typeof (item.imageUrl ?? item.mainImage ?? item.image) === "string" ? (item.imageUrl ?? item.mainImage ?? item.image) : "",
    priceCny: Number(item.priceCny ?? item.price ?? item.salePrice) || null,
    sales: Number(item.sales ?? item.salesCount) || null,
  };
}

async function listCategories() {
  const payload = await request({ path: "/catalog/categories", query: { page: 1, page_size: 50, status: "active" } });
  return (payload.items ?? []).map((item) => ({
    id: String(item.id ?? ""),
    name: String(item.name ?? item.title ?? "类目"),
    parentId: String(item.parentId ?? item.parent_id ?? ""),
  }));
}

async function listProducts(options = {}) {
  const payload = await request({
    path: "/catalog/spus",
    query: {
      category_id: options.categoryId,
      page: options.page ?? 1,
      page_size: options.pageSize ?? 20,
      q: options.keyword,
      shop_id: options.shopId,
      sort: options.sort,
    },
  });
  return {
    items: (payload.items ?? []).map(mapProductCard),
    total: Number(payload.pageInfo && payload.pageInfo.total) || 0,
  };
}

async function getProductDetail(productId) {
  const record = await request({ path: `/catalog/spus/${productId}` });
  if (!record || !record.id) {
    return null;
  }
  const skuItems = Array.isArray(record.skus) ? record.skus : [];
  const specItems = Array.isArray(record.specs) ? record.specs : [];
  const mainImage = typeof (record.imageUrl ?? record.mainImage) === "string" ? (record.imageUrl ?? record.mainImage) : "";
  const gallery = Array.isArray(record.images) || Array.isArray(record.galleryImages)
    ? (record.images ?? record.galleryImages).filter((entry) => typeof entry === "string" && entry)
    : [];
  const images = [...new Set([mainImage, ...gallery].filter(Boolean))];
  return {
    id: String(record.id ?? productId),
    title: String(record.title ?? record.name ?? "商品"),
    description: typeof record.description === "string" ? record.description : "",
    imageUrl: mainImage,
    images,
    priceCny: Number(record.priceCny ?? record.price) || null,
    sales: Number(record.sales ?? record.salesCount) || null,
    shopId: typeof record.shopId === "string" ? record.shopId : "",
    shopName: typeof record.shopName === "string" ? record.shopName : "",
    skus: skuItems.map((sku, index) => ({
      id: String(sku.id ?? `sku-${index + 1}`),
      title: String(sku.title ?? sku.name ?? `规格 ${index + 1}`),
      priceCny: Number(sku.priceCny ?? sku.price) || null,
      stock: Number(sku.stock ?? sku.quantity),
      imageUrl: typeof sku.imageUrl === "string" ? sku.imageUrl : "",
    })),
    specs: specItems.map((spec, index) => ({
      name: String(spec.name ?? `参数 ${index + 1}`),
      value: String(spec.value ?? "-"),
    })),
  };
}

module.exports = { listCategories, listProducts, getProductDetail };
