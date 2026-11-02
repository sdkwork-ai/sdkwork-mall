import { beforeEach, describe, expect, it } from "vitest";

import {
  clearMallH5Favorites,
  clearMallH5Footprint,
  readMallH5Favorites,
  readMallH5Footprint,
  recordMallH5Footprint,
  toggleMallH5Favorite,
} from "../src/favorites-service";

describe("sdkwork-mall-h5-buyer settings local-data actions", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("clears every locally stored favourite", () => {
    toggleMallH5Favorite({ id: "SPU-1", priceCny: 99, title: "SDKWork Phone" });
    toggleMallH5Favorite({ id: "SPU-2", priceCny: 19, title: "SDKWork Cable" });
    expect(readMallH5Favorites()).toHaveLength(2);

    clearMallH5Favorites();

    expect(readMallH5Favorites()).toEqual([]);
  });

  it("clears the browsing footprint without touching favourites", () => {
    toggleMallH5Favorite({ id: "SPU-1", priceCny: 99, title: "SDKWork Phone" });
    recordMallH5Footprint({ id: "SPU-3", title: "SDKWork Pad" });
    expect(readMallH5Footprint()).toHaveLength(1);

    clearMallH5Footprint();

    expect(readMallH5Footprint()).toEqual([]);
    expect(readMallH5Favorites()).toHaveLength(1);
  });
});
