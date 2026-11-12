import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configureCommerceServiceMockSession,
  createCommerceServiceMock,
  resetCommerceServiceMockSession,
} from "../../../tests/test-utils/commerce-service-mock";
import {
  createCommerceProductAdminService,
  createCommerceProductAdminWorkspaceManifest,
} from "../src";

describe("sdkwork-mall-pc-admin-product service", () => {
  beforeEach(() => {
    configureCommerceServiceMockSession({ authToken: "commerce-product-admin-token" });
  });

  afterEach(() => {
    resetCommerceServiceMockSession();
  });

  it("delegates the complete catalog admin workflow through the Commerce service boundary", async () => {
    const calls = {
      categoryCreate: vi.fn().mockResolvedValue({ data: { id: "category-1" } }),
      categoryUpdate: vi.fn().mockResolvedValue({ data: { id: "category-1", name: "Updated" } }),
      categoryDelete: vi.fn().mockResolvedValue({ data: { deleted: true } }),
      productCreate: vi.fn().mockResolvedValue({ data: { id: "product-1" } }),
      productUpdate: vi.fn().mockResolvedValue({ data: { id: "product-1", title: "Updated" } }),
      productDelete: vi.fn().mockResolvedValue({ data: { deleted: true } }),
      productPublish: vi.fn().mockResolvedValue({ data: { id: "product-1", status: "active" } }),
      productArchive: vi.fn().mockResolvedValue({ data: { id: "product-1", status: "archived" } }),
      skuCreate: vi.fn().mockResolvedValue({ data: { id: "sku-1" } }),
      skuUpdate: vi.fn().mockResolvedValue({ data: { id: "sku-1", skuNo: "SKU-1" } }),
      skuDelete: vi.fn().mockResolvedValue({ data: { deleted: true } }),
      brandCreate: vi.fn().mockResolvedValue({ data: { id: "brand-1" } }),
      attributeCreate: vi.fn().mockResolvedValue({ data: { id: "attribute-1" } }),
      attributeUpdate: vi.fn().mockResolvedValue({ data: { id: "attribute-1", name: "Updated" } }),
      attributeValueCreate: vi.fn().mockResolvedValue({ data: { id: "value-1" } }),
      categoryAttributeCreate: vi.fn().mockResolvedValue({ data: { id: "binding-1" } }),
      categoryAttributeUpdate: vi.fn().mockResolvedValue({ data: { id: "binding-1", required: true } }),
      categoryAttributeDelete: vi.fn().mockResolvedValue({ data: { deleted: true } }),
      priceListCreate: vi.fn().mockResolvedValue({ data: { id: "price-list-1" } }),
      priceListItemCreate: vi.fn().mockResolvedValue({ data: { id: "item-1" } }),
      mediaCreate: vi.fn().mockResolvedValue({ data: { id: "media-1" } }),
      productRetrieve: vi.fn().mockResolvedValue({ data: { id: "product-1" } }),
    };
    const commerceService = createCommerceServiceMock({
      admin: {
        catalog: {
          brands: {
            list: vi.fn().mockResolvedValue({ data: [{ id: "brand-1" }] }),
            retrieve: vi.fn().mockResolvedValue({ data: { id: "brand-1" } }),
            create: calls.brandCreate,
            update: vi.fn().mockResolvedValue({ data: { id: "brand-1" } }),
            delete: vi.fn().mockResolvedValue({ data: { deleted: true } }),
          },
          attributes: {
            management: {
              list: vi.fn().mockResolvedValue({ data: [{ id: "attribute-1" }] }),
            },
            create: calls.attributeCreate,
            update: calls.attributeUpdate,
          },
          attributeValues: {
            list: vi.fn().mockResolvedValue({ data: [{ id: "value-1" }] }),
            create: calls.attributeValueCreate,
            update: vi.fn().mockResolvedValue({ data: { id: "value-1", displayValue: "Updated" } }),
            delete: vi.fn().mockResolvedValue({ data: { deleted: true } }),
          },
          categories: {
            management: {
              list: vi.fn().mockResolvedValue({ data: [{ id: "category-1" }] }),
            },
            retrieve: vi.fn().mockResolvedValue({ data: { id: "category-1" } }),
            create: calls.categoryCreate,
            update: calls.categoryUpdate,
            delete: calls.categoryDelete,
          },
          categoryAttributes: {
            list: vi.fn().mockResolvedValue({ data: [{ id: "binding-1" }] }),
            create: calls.categoryAttributeCreate,
            update: calls.categoryAttributeUpdate,
            delete: calls.categoryAttributeDelete,
          },
          media: {
            list: vi.fn().mockResolvedValue({ data: [{ id: "media-1" }] }),
            create: calls.mediaCreate,
            update: vi.fn().mockResolvedValue({ data: { id: "media-1" } }),
            delete: vi.fn().mockResolvedValue({ data: { deleted: true } }),
          },
          priceListItems: {
            list: vi.fn().mockResolvedValue({ data: [{ id: "item-1" }] }),
            create: calls.priceListItemCreate,
            update: vi.fn().mockResolvedValue({ data: { id: "item-1" } }),
            delete: vi.fn().mockResolvedValue({ data: { deleted: true } }),
          },
          priceLists: {
            list: vi.fn().mockResolvedValue({ data: [{ id: "price-list-1" }] }),
            create: calls.priceListCreate,
            update: vi.fn().mockResolvedValue({ data: { id: "price-list-1" } }),
          },
          products: {
            management: {
              list: vi.fn().mockResolvedValue({ data: [{ id: "product-1" }] }),
              retrieve: calls.productRetrieve,
            },
            attributes: {
              update: vi.fn().mockResolvedValue({ data: { id: "product-1" } }),
            },
            create: calls.productCreate,
            update: calls.productUpdate,
            delete: calls.productDelete,
            publish: calls.productPublish,
            archive: calls.productArchive,
          },
          skus: {
            list: vi.fn().mockResolvedValue({ data: [{ id: "sku-1" }] }),
            retrieve: vi.fn().mockResolvedValue({ data: { id: "sku-1" } }),
            create: calls.skuCreate,
            update: calls.skuUpdate,
            delete: calls.skuDelete,
          },
        },
      },
    });
    const service = createCommerceProductAdminService({
      catalogAdmin: commerceService.admin.catalog,
    });

    await expect(service.listCategories({ page: "1" })).resolves.toEqual({ data: [{ id: "category-1" }] });
    await expect(service.createCategory({ name: "Root" })).resolves.toEqual({ data: { id: "category-1" } });
    await expect(service.updateCategory("category-1", { name: "Updated" }, 3)).resolves.toEqual({
      data: { id: "category-1", name: "Updated" },
    });
    await expect(service.deleteCategory("category-1", 4)).resolves.toEqual({ data: { deleted: true } });
    await expect(service.listProducts({ status: "active" })).resolves.toEqual({ data: [{ id: "product-1" }] });
    await expect(service.retrieveProduct("product-1")).resolves.toEqual({ data: { id: "product-1" } });
    await expect(service.createProduct({ title: "Product" })).resolves.toEqual({ data: { id: "product-1" } });
    await expect(service.updateProduct("product-1", { title: "Updated" }, 7)).resolves.toEqual({
      data: { id: "product-1", title: "Updated" },
    });
    await expect(service.deleteProduct("product-1", 8)).resolves.toEqual({ data: { deleted: true } });
    await expect(service.publishProduct("product-1", 9)).resolves.toEqual({
      data: { id: "product-1", status: "active" },
    });
    await expect(service.archiveProduct("product-1", 10)).resolves.toEqual({
      data: { id: "product-1", status: "archived" },
    });
    await expect(service.listSkus({ productId: "product-1" })).resolves.toEqual({ data: [{ id: "sku-1" }] });
    await expect(service.createSku({ skuNo: "SKU-1" })).resolves.toEqual({ data: { id: "sku-1" } });
    await expect(service.updateSku("sku-1", { skuNo: "SKU-1" }, 5)).resolves.toEqual({
      data: { id: "sku-1", skuNo: "SKU-1" },
    });
    await expect(service.deleteSku("sku-1", 6)).resolves.toEqual({ data: { deleted: true } });
    await expect(service.listAttributes({ scope: "sku" })).resolves.toEqual({ data: [{ id: "attribute-1" }] });
    await expect(service.createAttribute({ name: "Color" })).resolves.toEqual({ data: { id: "attribute-1" } });
    await expect(service.updateAttribute("attribute-1", { name: "Updated" }, 2)).resolves.toEqual({
      data: { id: "attribute-1", name: "Updated" },
    });
    await expect(service.listAttributeValues({ attributeId: "attribute-1" })).resolves.toEqual({
      data: [{ id: "value-1" }],
    });
    await expect(service.createAttributeValue({ attributeId: "attribute-1" })).resolves.toEqual({
      data: { id: "value-1" },
    });
    await expect(service.listCategoryAttributes({ categoryId: "category-1" })).resolves.toEqual({
      data: [{ id: "binding-1" }],
    });
    await expect(service.createCategoryAttribute({ categoryId: "category-1" })).resolves.toEqual({
      data: { id: "binding-1" },
    });
    await expect(service.updateCategoryAttribute("binding-1", { required: true }, 3)).resolves.toEqual({
      data: { id: "binding-1", required: true },
    });
    await expect(service.deleteCategoryAttribute("binding-1", 4)).resolves.toEqual({ data: { deleted: true } });
    await expect(service.listPriceLists({ page: "1" })).resolves.toEqual({ data: [{ id: "price-list-1" }] });
    await expect(service.createPriceList({ name: "Default" })).resolves.toEqual({ data: { id: "price-list-1" } });
    await expect(service.listBrands({ page: "1" })).resolves.toEqual({ data: [{ id: "brand-1" }] });
    await expect(service.retrieveBrand("brand-1")).resolves.toEqual({ data: { id: "brand-1" } });
    await expect(service.createBrand({ brandNo: "BRAND-0001", name: "星野" })).resolves.toEqual({
      data: { id: "brand-1" },
    });
    await expect(service.updateBrand("brand-1", { name: "星野" }, 2)).resolves.toEqual({
      data: { id: "brand-1" },
    });
    await expect(service.deleteBrand("brand-1", 3)).resolves.toEqual({ data: { deleted: true } });
    await expect(service.listPriceListItems({ priceListId: "price-list-1" })).resolves.toEqual({
      data: [{ id: "item-1" }],
    });
    await expect(service.createPriceListItem({ priceListId: "price-list-1" })).resolves.toEqual({
      data: { id: "item-1" },
    });
    await expect(service.listMedia({ ownerType: "spu" })).resolves.toEqual({ data: [{ id: "media-1" }] });
    await expect(service.createMedia({ ownerType: "spu" })).resolves.toEqual({ data: { id: "media-1" } });

    expect(calls.brandCreate).toHaveBeenCalledWith({ brandNo: "BRAND-0001", name: "星野" });
    expect(calls.categoryCreate).toHaveBeenCalledWith({ name: "Root" });
    expect(calls.categoryUpdate).toHaveBeenCalledWith("category-1", { name: "Updated" }, 3);
    expect(calls.categoryDelete).toHaveBeenCalledWith("category-1", 4);
    expect(calls.productPublish).toHaveBeenCalledWith("product-1", 9);
    expect(calls.productArchive).toHaveBeenCalledWith("product-1", 10);
    expect(calls.productRetrieve).toHaveBeenCalledWith("product-1");
    expect(calls.productDelete).toHaveBeenCalledWith("product-1", 8);
    expect(calls.skuDelete).toHaveBeenCalledWith("sku-1", 6);
    expect(calls.categoryAttributeUpdate).toHaveBeenCalledWith("binding-1", { required: true }, 3);
  });

  it("exports a reusable workspace manifest for Cloud Router integration", () => {
    expect(createCommerceProductAdminWorkspaceManifest()).toMatchObject({
      capability: "product-admin",
      packageNames: ["@sdkwork/mall-pc-admin-product"],
      routePath: "/admin/catalog",
    });
  });

  it("keeps the product admin remote boundary on admin remote port only", () => {
    const source = readFileSync(
      "apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-admin-product/src/catalogService.ts",
      "utf8",
    );

    expect(source).toContain("@sdkwork/mall-pc-admin-core/admin-remote-port");
    expect(source).toContain("getSdkworkAdminRemotePort");
    expect(source).toContain("catalog.products.management.retrieve");
    expect(source).toContain("catalog.categories.management.list");
    expect(source).toContain("catalog.attributes.management.list");
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/\baxios\b/);
    expect(source).not.toContain("cloudrouter-backend-sdk");
  });

  it("keeps product admin catalog field names on the canonical commerce contract", () => {
    const sourceFiles = [
      "apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-admin-product/src/ProductCreatePage.tsx",
      "apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-admin-product/src/SkuManagementPage.tsx",
    ];
    const retiredFieldNames = ["deliveryMode", "delivery_mode", "salesStatus", "sales_status"];

    for (const sourceFile of sourceFiles) {
      const source = readFileSync(sourceFile, "utf8");

      for (const fieldName of retiredFieldNames) {
        expect(source, `${sourceFile} must not contain retired field ${fieldName}`).not.toContain(fieldName);
      }
    }
  });

  it("loads edit drafts through backend product retrieve instead of list-search fallback", () => {
    const sourceFile = "apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-admin-product/src/ProductCreatePage.tsx";
    const source = readFileSync(sourceFile, "utf8");

    expect(source).toContain("retrieveCommerceProduct");
    for (const retiredEditLookup of [
      "fallbackResult",
      "fallbackMatch",
      "listCommerceProducts({ page: '1', pageSize: '50', q: productId })",
    ]) {
      expect(source, `${sourceFile} must not contain edit lookup fallback ${retiredEditLookup}`).not.toContain(
        retiredEditLookup,
      );
    }
  });

  it("exposes commercial product center view-model helpers and editor panels", () => {
    const packageRoot = "apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-admin-product/src";
    const createPageSource = readFileSync(`${packageRoot}/ProductCreatePage.tsx`, "utf8");
    const listPageSource = readFileSync(`${packageRoot}/ProductListPage.tsx`, "utf8");
    const mappingSource = readFileSync(`${packageRoot}/productAdminMapping.ts`, "utf8");
    const readinessSource = readFileSync(`${packageRoot}/productAdminReadiness.ts`, "utf8");

    for (const marker of [
      "ProductDetailConfigPanel",
      "ProductStoreInventoryPanel",
      "ProductPublishReadinessPanel",
      "ProductAttributeValuePanel",
      "SkuMatrixCommercialPanel",
    ]) {
      expect(createPageSource).toContain(marker);
    }

    expect(mappingSource).toContain("readCommercialProductMetadata");
    expect(mappingSource).toContain("productDetailConfig");
    expect(mappingSource).toContain("storeVisibility");
    expect(mappingSource).toContain("categoryAttributeValues");
    expect(mappingSource).toContain("skuAttributeValues");
    expect(mappingSource).toContain("publishReadiness");
    expect(mappingSource).toContain("readProductCommercialSignals");
    expect(readinessSource).toContain("evaluateProductReadiness");
    expect(readinessSource).toContain("Physical products require inventory source policy before publish.");
    // Authority write contract (`sdkwork-merchandise` closed bodies): the
    // create payload carries `productNo`, SKU prices ride the minor-unit wire
    // rule, and publishing is the `products.publish` command.
    expect(createPageSource).toContain("buildProductCreatePayload");
    expect(createPageSource).toContain("buildProductUpdatePayload");
    expect(createPageSource).toContain("productNo: draft.spuNo");
    // The brand selector attributes the product to an authority brand row.
    expect(createPageSource).toContain("listCommerceBrands");
    expect(createPageSource).toContain("draft.brandId ? { brandId: draft.brandId }");
    expect(createPageSource).toContain("salePriceMinor");
    expect(createPageSource).toContain("publishCommerceProduct");
    expect(listPageSource).toContain("readProductCommercialSignals");
    expect(listPageSource).toContain("data-admin-product-commercial-signals");
  });
});
