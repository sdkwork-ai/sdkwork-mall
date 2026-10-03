import { type MpTapEvent } from "../../types/common";
import {
  readFavorites,
  removeFavorite,
  type MpFavoriteItem,
} from "../../services/favorites-service";
import { formatCny } from "../../utils/format";

interface FavoriteRow extends MpFavoriteItem {
  priceText: string;
}

interface FavoritesData {
  loading: boolean;
  busy: boolean;
  favorites: FavoriteRow[];
  toast: string;
  _toastTimer: number | null;
}

function toRows(favorites: MpFavoriteItem[]): FavoriteRow[] {
  return favorites.map((item) => ({
    ...item,
    priceText: item.priceCny != null ? formatCny(item.priceCny) : "",
  }));
}

Page({
  data: {
    loading: true,
    busy: false,
    favorites: [],
    toast: "",
    _toastTimer: null,
  } as FavoritesData,

  onShow() {
    // onShow (not onLoad) so returning from a PDP refreshes the list.
    this.setData({ favorites: toRows(readFavorites()), loading: false });
  },

  goProduct(event: MpTapEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    if (id) {
      wx.navigateTo({ url: `/pages/product/index?id=${id}` });
    }
  },

  remove(event: MpTapEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    if (!id) {
      return;
    }
    this.setData({ busy: true });
    try {
      removeFavorite(id);
      this.setData({ favorites: toRows(readFavorites()) });
      this.showToast("已取消收藏");
    } finally {
      this.setData({ busy: false });
    }
  },

  showToast(message: string) {
    this.setData({ toast: message });
    if (this.data._toastTimer != null) {
      clearTimeout(this.data._toastTimer);
    }
    this.setData({ _toastTimer: setTimeout(() => this.setData({ toast: "" }), 2200) });
  },
});
