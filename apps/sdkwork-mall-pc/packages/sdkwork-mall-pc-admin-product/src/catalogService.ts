import {
  getSdkworkAdminRemotePort,
  type SdkworkAdminCatalogNamespace,
} from "@sdkwork/mall-pc-admin-core/admin-remote-port";

export interface CreateCommerceProductAdminServiceOptions {
  catalogAdmin?: SdkworkAdminCatalogNamespace;
}

type CatalogAdminService = SdkworkAdminCatalogNamespace;

/**
 * Product-admin service over the merchandise authority catalog surface.
 *
 * Every guarded write carries the row version the caller last read
 * (`expectedVersion`), which the bootstrap translates into the `If-Match`
 * precondition the authority requires (`API_SPEC` section 17).
 */
export interface CommerceProductAdminService {
  listBrands(params?: Record<string, unknown>): Promise<unknown>;
  retrieveBrand(brandId: string): Promise<unknown>;
  createBrand(body: Record<string, unknown>): Promise<unknown>;
  updateBrand(
    brandId: string,
    body: Record<string, unknown>,
    expectedVersion: number,
  ): Promise<unknown>;
  deleteBrand(brandId: string, expectedVersion: number): Promise<unknown>;
  listCategories(params?: Record<string, unknown>): Promise<unknown>;
  createCategory(body: Record<string, unknown>): Promise<unknown>;
  updateCategory(
    categoryId: string,
    body: Record<string, unknown>,
    expectedVersion: number,
  ): Promise<unknown>;
  deleteCategory(categoryId: string, expectedVersion: number): Promise<unknown>;
  listProducts(params?: Record<string, unknown>): Promise<unknown>;
  retrieveProduct(productId: string): Promise<unknown>;
  createProduct(body: Record<string, unknown>): Promise<unknown>;
  updateProduct(
    productId: string,
    body: Record<string, unknown>,
    expectedVersion: number,
  ): Promise<unknown>;
  deleteProduct(productId: string, expectedVersion: number): Promise<unknown>;
  publishProduct(productId: string, expectedVersion: number): Promise<unknown>;
  archiveProduct(productId: string, expectedVersion: number): Promise<unknown>;
  updateProductAttributes(
    productId: string,
    body: Record<string, unknown>,
    expectedVersion: number,
  ): Promise<unknown>;
  listSkus(params?: Record<string, unknown>): Promise<unknown>;
  retrieveSku(skuId: string): Promise<unknown>;
  createSku(body: Record<string, unknown>): Promise<unknown>;
  updateSku(
    skuId: string,
    body: Record<string, unknown>,
    expectedVersion: number,
  ): Promise<unknown>;
  deleteSku(skuId: string, expectedVersion: number): Promise<unknown>;
  listAttributes(params?: Record<string, unknown>): Promise<unknown>;
  createAttribute(body: Record<string, unknown>): Promise<unknown>;
  updateAttribute(
    attributeId: string,
    body: Record<string, unknown>,
    expectedVersion: number,
  ): Promise<unknown>;
  listAttributeValues(params?: Record<string, unknown>): Promise<unknown>;
  createAttributeValue(body: Record<string, unknown>): Promise<unknown>;
  updateAttributeValue(
    valueId: string,
    body: Record<string, unknown>,
    expectedVersion: number,
  ): Promise<unknown>;
  deleteAttributeValue(valueId: string, expectedVersion: number): Promise<unknown>;
  listCategoryAttributes(params?: Record<string, unknown>): Promise<unknown>;
  createCategoryAttribute(body: Record<string, unknown>): Promise<unknown>;
  updateCategoryAttribute(
    bindingId: string,
    body: Record<string, unknown>,
    expectedVersion: number,
  ): Promise<unknown>;
  deleteCategoryAttribute(bindingId: string, expectedVersion: number): Promise<unknown>;
  listPriceLists(params?: Record<string, unknown>): Promise<unknown>;
  createPriceList(body: Record<string, unknown>): Promise<unknown>;
  updatePriceList(
    priceListId: string,
    body: Record<string, unknown>,
    expectedVersion: number,
  ): Promise<unknown>;
  listPriceListItems(params?: Record<string, unknown>): Promise<unknown>;
  createPriceListItem(body: Record<string, unknown>): Promise<unknown>;
  updatePriceListItem(
    itemId: string,
    body: Record<string, unknown>,
    expectedVersion: number,
  ): Promise<unknown>;
  deletePriceListItem(itemId: string, expectedVersion: number): Promise<unknown>;
  listMedia(params?: Record<string, unknown>): Promise<unknown>;
  createMedia(body: Record<string, unknown>): Promise<unknown>;
  updateMedia(
    mediaId: string,
    body: Record<string, unknown>,
    expectedVersion: number,
  ): Promise<unknown>;
  deleteMedia(mediaId: string, expectedVersion: number): Promise<unknown>;
}

export function createCommerceProductAdminService(
  options: CreateCommerceProductAdminServiceOptions = {},
): CommerceProductAdminService {
  const catalog = resolveCatalogService(options.catalogAdmin);
  return {
    listBrands: (params) => catalog.brands.list(params),
    retrieveBrand: (brandId) => catalog.brands.retrieve(brandId),
    createBrand: (body) => catalog.brands.create(body),
    updateBrand: (brandId, body, expectedVersion) =>
      catalog.brands.update(brandId, body, expectedVersion),
    deleteBrand: (brandId, expectedVersion) => catalog.brands.delete(brandId, expectedVersion),
    listCategories: (params) => catalog.categories.management.list(params),
    createCategory: (body) => catalog.categories.create(body),
    updateCategory: (categoryId, body, expectedVersion) =>
      catalog.categories.update(categoryId, body, expectedVersion),
    deleteCategory: (categoryId, expectedVersion) =>
      catalog.categories.delete(categoryId, expectedVersion),
    listProducts: (params) => catalog.products.management.list(params),
    retrieveProduct: (productId) => catalog.products.management.retrieve(productId),
    createProduct: (body) => catalog.products.create(body),
    updateProduct: (productId, body, expectedVersion) =>
      catalog.products.update(productId, body, expectedVersion),
    deleteProduct: (productId, expectedVersion) =>
      catalog.products.delete(productId, expectedVersion),
    publishProduct: (productId, expectedVersion) =>
      catalog.products.publish(productId, expectedVersion),
    archiveProduct: (productId, expectedVersion) =>
      catalog.products.archive(productId, expectedVersion),
    updateProductAttributes: (productId, body, expectedVersion) =>
      catalog.products.attributes.update(productId, body, expectedVersion),
    listSkus: (params) => catalog.skus.list(params),
    retrieveSku: (skuId) => catalog.skus.retrieve(skuId),
    createSku: (body) => catalog.skus.create(body),
    updateSku: (skuId, body, expectedVersion) =>
      catalog.skus.update(skuId, body, expectedVersion),
    deleteSku: (skuId, expectedVersion) => catalog.skus.delete(skuId, expectedVersion),
    listAttributes: (params) => catalog.attributes.management.list(params),
    createAttribute: (body) => catalog.attributes.create(body),
    updateAttribute: (attributeId, body, expectedVersion) =>
      catalog.attributes.update(attributeId, body, expectedVersion),
    listAttributeValues: (params) => catalog.attributeValues.list(params),
    createAttributeValue: (body) => catalog.attributeValues.create(body),
    updateAttributeValue: (valueId, body, expectedVersion) =>
      catalog.attributeValues.update(valueId, body, expectedVersion),
    deleteAttributeValue: (valueId, expectedVersion) =>
      catalog.attributeValues.delete(valueId, expectedVersion),
    listCategoryAttributes: (params) => catalog.categoryAttributes.list(params),
    createCategoryAttribute: (body) => catalog.categoryAttributes.create(body),
    updateCategoryAttribute: (bindingId, body, expectedVersion) =>
      catalog.categoryAttributes.update(bindingId, body, expectedVersion),
    deleteCategoryAttribute: (bindingId, expectedVersion) =>
      catalog.categoryAttributes.delete(bindingId, expectedVersion),
    listPriceLists: (params) => catalog.priceLists.list(params),
    createPriceList: (body) => catalog.priceLists.create(body),
    updatePriceList: (priceListId, body, expectedVersion) =>
      catalog.priceLists.update(priceListId, body, expectedVersion),
    listPriceListItems: (params) => catalog.priceListItems.list(params),
    createPriceListItem: (body) => catalog.priceListItems.create(body),
    updatePriceListItem: (itemId, body, expectedVersion) =>
      catalog.priceListItems.update(itemId, body, expectedVersion),
    deletePriceListItem: (itemId, expectedVersion) =>
      catalog.priceListItems.delete(itemId, expectedVersion),
    listMedia: (params) => catalog.media.list(params),
    createMedia: (body) => catalog.media.create(body),
    updateMedia: (mediaId, body, expectedVersion) =>
      catalog.media.update(mediaId, body, expectedVersion),
    deleteMedia: (mediaId, expectedVersion) => catalog.media.delete(mediaId, expectedVersion),
  };
}

export function createCommerceProductAdminWorkspaceManifest() {
  return {
    capability: "product-admin",
    packageNames: ["@sdkwork/mall-pc-admin-product"],
    routePath: "/admin/catalog",
    source: "commerce-product-admin-workspace",
  };
}

function resolveCatalogService(catalogAdmin?: SdkworkAdminCatalogNamespace): CatalogAdminService {
  return catalogAdmin ?? getSdkworkAdminRemotePort().admin.catalog;
}

function defaultService(): CommerceProductAdminService {
  return createCommerceProductAdminService();
}

export async function listCommerceCategories(params?: Record<string, unknown>) {
  return defaultService().listCategories(params);
}

export async function listCommerceProducts(params?: Record<string, unknown>) {
  return defaultService().listProducts(params);
}

export async function listCommerceBrands(params?: Record<string, unknown>) {
  return defaultService().listBrands(params);
}

export async function retrieveCommerceBrand(brandId: string) {
  return defaultService().retrieveBrand(brandId);
}

export async function createCommerceBrand(body: Record<string, unknown>) {
  return defaultService().createBrand(body);
}

export async function updateCommerceBrand(
  brandId: string,
  body: Record<string, unknown>,
  expectedVersion: number,
) {
  return defaultService().updateBrand(brandId, body, expectedVersion);
}

export async function deleteCommerceBrand(brandId: string, expectedVersion: number) {
  return defaultService().deleteBrand(brandId, expectedVersion);
}

export async function retrieveCommerceProduct(productId: string) {
  return defaultService().retrieveProduct(productId);
}

export async function listCommerceSkus(params?: Record<string, unknown>) {
  return defaultService().listSkus(params);
}

export async function listCommerceAttributes(params?: Record<string, unknown>) {
  return defaultService().listAttributes(params);
}

export async function listCommerceCategoryAttributes(params?: Record<string, unknown>) {
  return defaultService().listCategoryAttributes(params);
}

export async function listCommercePriceLists(params?: Record<string, unknown>) {
  return defaultService().listPriceLists(params);
}

export async function createCommerceCategory(body: Record<string, unknown>) {
  return defaultService().createCategory(body);
}

export async function updateCommerceCategory(
  categoryId: string,
  body: Record<string, unknown>,
  expectedVersion: number,
) {
  return defaultService().updateCategory(categoryId, body, expectedVersion);
}

export async function deleteCommerceCategory(categoryId: string, expectedVersion: number) {
  return defaultService().deleteCategory(categoryId, expectedVersion);
}

export async function createCommerceProduct(body: Record<string, unknown>) {
  return defaultService().createProduct(body);
}

export async function updateCommerceProduct(
  productId: string,
  body: Record<string, unknown>,
  expectedVersion: number,
) {
  return defaultService().updateProduct(productId, body, expectedVersion);
}

export async function deleteCommerceProduct(productId: string, expectedVersion: number) {
  return defaultService().deleteProduct(productId, expectedVersion);
}

export async function publishCommerceProduct(productId: string, expectedVersion: number) {
  return defaultService().publishProduct(productId, expectedVersion);
}

export async function archiveCommerceProduct(productId: string, expectedVersion: number) {
  return defaultService().archiveProduct(productId, expectedVersion);
}

export async function updateCommerceProductAttributes(
  productId: string,
  body: Record<string, unknown>,
  expectedVersion: number,
) {
  return defaultService().updateProductAttributes(productId, body, expectedVersion);
}

export async function createCommerceSku(body: Record<string, unknown>) {
  return defaultService().createSku(body);
}

export async function updateCommerceSku(
  skuId: string,
  body: Record<string, unknown>,
  expectedVersion: number,
) {
  return defaultService().updateSku(skuId, body, expectedVersion);
}

export async function deleteCommerceSku(skuId: string, expectedVersion: number) {
  return defaultService().deleteSku(skuId, expectedVersion);
}

export async function createCommerceAttribute(body: Record<string, unknown>) {
  return defaultService().createAttribute(body);
}

export async function updateCommerceAttribute(
  attributeId: string,
  body: Record<string, unknown>,
  expectedVersion: number,
) {
  return defaultService().updateAttribute(attributeId, body, expectedVersion);
}

export async function listCommerceAttributeValues(params?: Record<string, unknown>) {
  return defaultService().listAttributeValues(params);
}

export async function createCommerceAttributeValue(body: Record<string, unknown>) {
  return defaultService().createAttributeValue(body);
}

export async function updateCommerceAttributeValue(
  valueId: string,
  body: Record<string, unknown>,
  expectedVersion: number,
) {
  return defaultService().updateAttributeValue(valueId, body, expectedVersion);
}

export async function deleteCommerceAttributeValue(valueId: string, expectedVersion: number) {
  return defaultService().deleteAttributeValue(valueId, expectedVersion);
}

export async function createCommerceCategoryAttribute(body: Record<string, unknown>) {
  return defaultService().createCategoryAttribute(body);
}

export async function updateCommerceCategoryAttribute(
  bindingId: string,
  body: Record<string, unknown>,
  expectedVersion: number,
) {
  return defaultService().updateCategoryAttribute(bindingId, body, expectedVersion);
}

export async function deleteCommerceCategoryAttribute(
  bindingId: string,
  expectedVersion: number,
) {
  return defaultService().deleteCategoryAttribute(bindingId, expectedVersion);
}

export async function createCommercePriceList(body: Record<string, unknown>) {
  return defaultService().createPriceList(body);
}

export async function updateCommercePriceList(
  priceListId: string,
  body: Record<string, unknown>,
  expectedVersion: number,
) {
  return defaultService().updatePriceList(priceListId, body, expectedVersion);
}

export async function listCommercePriceListItems(params?: Record<string, unknown>) {
  return defaultService().listPriceListItems(params);
}

export async function createCommercePriceListItem(body: Record<string, unknown>) {
  return defaultService().createPriceListItem(body);
}

export async function updateCommercePriceListItem(
  itemId: string,
  body: Record<string, unknown>,
  expectedVersion: number,
) {
  return defaultService().updatePriceListItem(itemId, body, expectedVersion);
}

export async function deleteCommercePriceListItem(itemId: string, expectedVersion: number) {
  return defaultService().deletePriceListItem(itemId, expectedVersion);
}

export async function listCommerceMedia(params?: Record<string, unknown>) {
  return defaultService().listMedia(params);
}

export async function createCommerceMedia(body: Record<string, unknown>) {
  return defaultService().createMedia(body);
}

export async function updateCommerceMedia(
  mediaId: string,
  body: Record<string, unknown>,
  expectedVersion: number,
) {
  return defaultService().updateMedia(mediaId, body, expectedVersion);
}

export async function deleteCommerceMedia(mediaId: string, expectedVersion: number) {
  return defaultService().deleteMedia(mediaId, expectedVersion);
}
