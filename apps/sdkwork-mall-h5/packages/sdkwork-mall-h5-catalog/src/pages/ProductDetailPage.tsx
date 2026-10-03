import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Home,
  MapPin,
  MessageCircle,
  Share2,
  ShoppingCart,
  Star,
  Ticket,
} from "lucide-react";

import {
  addMallH5CartItem,
  claimMallH5ProductOffer,
  listMallH5ProductOffers,
  retrieveMallH5ProductDetail,
  searchMallH5Products,
  type MallH5ProductCard,
  type MallH5ProductDetail,
  type MallH5ProductOffer,
} from "../catalog-service";
import {
  isMallH5Favorite,
  recordMallH5Footprint,
  toggleMallH5Favorite,
} from "@sdkwork/mall-h5-buyer/favorites-service";
import { listMallH5Addresses } from "@sdkwork/mall-h5-buyer/addresses-service";
import { readMallH5CartCount, writeMallH5CartCount } from "@sdkwork/mall-h5-commons";

function bumpLocalCartBadge(delta: number): void {
  writeMallH5CartCount(readMallH5CartCount() + delta);
}

let toastTimer: number | undefined;

interface DeliveryTarget {
  addressLine: string;
  id: string;
  receiverName: string;
}

export function SdkworkMallH5ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<MallH5ProductDetail | null>(null);
  const [recommendations, setRecommendations] = useState<MallH5ProductCard[]>([]);
  const [offers, setOffers] = useState<MallH5ProductOffer[]>([]);
  const [delivery, setDelivery] = useState<DeliveryTarget | null>(null);
  const [selectedSkuId, setSelectedSkuId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [couponSheetOpen, setCouponSheetOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [showCompact, setShowCompact] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [favoriteFlag, setFavoriteFlag] = useState(() => (productId ? isMallH5Favorite(productId) : false));
  const galleryRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer !== undefined) {
      window.clearTimeout(toastTimer);
    }
    toastTimer = window.setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => {
    if (!productId) {
      return;
    }
    let active = true;
    setLoading(true);
    retrieveMallH5ProductDetail(productId)
      .then((record) => {
        if (!active) {
          return;
        }
        if (record) {
          recordMallH5Footprint({
            id: record.id,
            imageUrl: record.imageUrl,
            title: record.title,
          });
        }
        setDetail(record);
        setSelectedSkuId(record?.skus[0]?.id ?? "");
      })
      .catch((cause: unknown) => {
        if (active) {
          setMessage(cause instanceof Error ? cause.message : "商品加载失败");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [productId]);

  useEffect(() => {
    let active = true;
    searchMallH5Products({ pageSize: 8, sort: "sales" })
      .then((result) => {
        if (active) {
          setRecommendations(result.items.filter((item) => item.id !== productId).slice(0, 4));
        }
      })
      .catch(() => {
        // 推荐区为可选增强。
      });
    return () => {
      active = false;
    };
  }, [productId]);

  useEffect(() => {
    let active = true;
    listMallH5ProductOffers()
      .then((rows) => {
        if (active) {
          setOffers(rows);
        }
      })
      .catch(() => {
        // 促销行是可选增强。
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    listMallH5Addresses()
      .then((rows) => {
        if (!active) {
          return;
        }
        const fallback = rows.find((row) => row.isDefault) ?? rows[0];
        if (fallback) {
          setDelivery({
            addressLine: fallback.addressLine,
            id: fallback.id,
            receiverName: fallback.receiverName,
          });
        }
      })
      .catch(() => {
        // 送至行为可选增强。
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setActiveImage(0);
    setShowCompact(false);
    setShowSearchBar(false);
  }, [productId]);

  useEffect(() => {
    // 京东式:上滑浮出搜索头;下滑或回到画廊附近时隐藏,价格紧凑条仅在下滑态出现。
    let lastScrollY = 0;
    function onScroll() {
      const y = window.scrollY;
      // 同位置的重复 scroll 事件(滚动停止时的收尾触发)不得翻转方向状态。
      if (Math.abs(y - lastScrollY) < 4) {
        return;
      }
      const goingUp = y < lastScrollY - 4;
      lastScrollY = y;
      setShowSearchBar(y > 240 && goingUp);
      setShowCompact(y > 280 && !goingUp);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const selectedSku = useMemo(
    () => detail?.skus.find((sku) => sku.id === selectedSkuId) ?? detail?.skus[0],
    [detail, selectedSkuId],
  );
  const displayPrice = selectedSku?.priceCny ?? detail?.priceCny ?? null;
  const galleryImages = useMemo(() => {
    if (detail?.images.length) {
      return detail.images;
    }
    return detail?.imageUrl ? [detail.imageUrl] : [];
  }, [detail]);
  const maxQuantity =
    selectedSku?.stock ?? detail?.skus.reduce((sum, sku) => sum + (sku.stock ?? 0), 0) ?? null;
  const soldOut = maxQuantity != null && maxQuantity <= 0;
  const stockUrgent = !soldOut && maxQuantity != null && maxQuantity < 20;

  const selectSku = useCallback(
    (skuId: string) => {
      const sku = detail?.skus.find((entry) => entry.id === skuId);
      setSelectedSkuId(skuId);
      setQuantity(1);
      const stock = sku?.stock ?? null;
      return stock;
    },
    [detail],
  );

  async function handleAddToCart(): Promise<boolean> {
    if (!detail || !selectedSku) {
      return false;
    }
    if (maxQuantity != null && quantity > maxQuantity) {
      showToast(`库存不足，最多可购 ${maxQuantity} 件`);
      return false;
    }
    setBusy(true);
    try {
      await addMallH5CartItem({
        productId: detail.id,
        quantity,
        skuId: selectedSku.id,
      });
      bumpLocalCartBadge(quantity);
      showToast("已加入购物车");
      return true;
    } catch (cause: unknown) {
      showToast(cause instanceof Error ? cause.message : "加入购物车失败");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function handleBuyNow() {
    if (!detail || !selectedSku) {
      return;
    }
    void handleAddToCart().then((added) => {
      if (added) {
        navigate("/cart");
      }
    });
  }

  function handleShare() {
    if (!detail) {
      return;
    }
    const shareUrl = window.location.href;
    const navigatorWithShare = navigator as Navigator & {
      share?: (data: { title: string; url: string }) => Promise<void>;
    };
    if (typeof navigatorWithShare.share === "function") {
      navigatorWithShare
        .share({ title: detail.title, url: shareUrl })
        .catch(() => {
          // 用户取消分享不算失败。
        });
      return;
    }
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => showToast("链接已复制，去分享给好友吧"))
      .catch(() => showToast("分享失败，请稍后再试"));
  }

  function handleGalleryScroll() {
    const node = galleryRef.current;
    if (!node || node.clientWidth === 0) {
      return;
    }
    setActiveImage(Math.round(node.scrollLeft / node.clientWidth));
  }

  function goToImage(index: number) {
    const node = galleryRef.current;
    if (!node) {
      return;
    }
    const clamped = Math.max(0, Math.min(index, galleryImages.length - 1));
    node.scrollTo({ left: clamped * node.clientWidth, behavior: "smooth" });
    setActiveImage(clamped);
  }

  async function handleClaim(offerId: string) {
    setClaiming(true);
    try {
      await claimMallH5ProductOffer(offerId);
      setOffers((current) => current.filter((offer) => offer.id !== offerId));
      showToast("领取成功，可在「我的-领券中心」查看");
      setCouponSheetOpen(false);
    } catch (cause: unknown) {
      showToast(cause instanceof Error ? cause.message : "领取失败");
    } finally {
      setClaiming(false);
    }
  }

  if (loading) {
    return <div className="sdk-h5-page sdk-h5-loading">加载商品...</div>;
  }

  if (!detail) {
    return (
      <div className="sdk-h5-page">
        <div className="sdk-h5-empty">商品不存在或已下架</div>
        <div className="sdk-h5-center">
          <Link className="sdk-h5-button" to="/">回到首页</Link>
        </div>
      </div>
    );
  }

  const titleBar = (
    <>
      <button
        aria-label="返回"
        className="sdk-h5-pdp-float-btn sdk-h5-pdp-float-back"
        onClick={() => navigate(-1)}
        type="button"
      >
        <ChevronLeft aria-hidden="true" size={20} />
      </button>
      <button
        aria-label="回到首页"
        className="sdk-h5-pdp-float-btn"
        onClick={() => navigate("/")}
        type="button"
      >
        <Home aria-hidden="true" size={18} />
      </button>
      <button
        aria-label="分享"
        className="sdk-h5-pdp-float-btn"
        onClick={handleShare}
        type="button"
      >
        <Share2 aria-hidden="true" size={18} />
      </button>
    </>
  );

  return (
    <div className="sdk-h5-page sdk-h5-pdp">
      {/* 上滑浮出的搜索头 */}
      <button
        aria-label="搜索商品"
        className={showSearchBar ? "sdk-h5-pdp-searchbar sdk-h5-pdp-searchbar-show" : "sdk-h5-pdp-searchbar"}
        onClick={() => navigate("/search")}
        type="button"
      >
        搜索商品 / 品牌 / 店铺
      </button>

      {/* 滚动后的紧凑头部 */}
      <header className={showCompact ? "sdk-h5-pdp-compact sdk-h5-pdp-compact-show" : "sdk-h5-pdp-compact"}>
        <span className="sdk-h5-pdp-compact-price">
          {displayPrice != null ? `¥${displayPrice.toFixed(2)}` : "询价"}
        </span>
        <span className="sdk-h5-pdp-compact-title">{detail.title}</span>
      </header>

      {/* 画廊 */}
      <section className="sdk-h5-pdp-gallery">
        {titleBar}
        {galleryImages.length > 0 ? (
          <>
            <div
              className="sdk-h5-pdp-gallery-track"
              onClick={() => setPreviewOpen(true)}
              onKeyDown={() => {}}
              ref={galleryRef}
              role="presentation"
              onScroll={handleGalleryScroll}
            >
              {galleryImages.map((image, index) => (
                <div className="sdk-h5-pdp-gallery-slide" key={`${image}-${index}`}>
                  <img alt={`${detail.title} 图片 ${index + 1}`} loading={index === 0 ? "eager" : "lazy"} src={image} />
                </div>
              ))}
            </div>
            <span aria-live="polite" className="sdk-h5-pdp-gallery-counter">
              {activeImage + 1}/{galleryImages.length}
            </span>
            {galleryImages.length > 1 ? (
              <div className="sdk-h5-pdp-gallery-dots" role="tablist" aria-label="图片导航">
                {galleryImages.map((image, index) => (
                  <button
                    aria-label={`查看第 ${index + 1} 张图片`}
                    aria-selected={index === activeImage}
                    className={index === activeImage ? "sdk-h5-pdp-gallery-dot sdk-h5-pdp-gallery-dot-active" : "sdk-h5-pdp-gallery-dot"}
                    key={`${image}-dot-${index}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      goToImage(index);
                    }}
                    role="tab"
                    type="button"
                  />
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="sdk-h5-pdp-gallery-fallback">暂无主图</div>
        )}
      </section>

      {/* 价格与标题 */}
      <section className="sdk-h5-pdp-summary">
        <div className="sdk-h5-pdp-price-row">
          <span className="sdk-h5-pdp-price">
            {displayPrice != null ? <>¥{displayPrice.toFixed(2)}</> : "询价"}
          </span>
          <button
            aria-label={favoriteFlag ? "取消收藏" : "收藏商品"}
            className={favoriteFlag ? "sdk-h5-pdp-fav sdk-h5-pdp-fav-on" : "sdk-h5-pdp-fav"}
            onClick={() => setFavoriteFlag(toggleMallH5Favorite({
              id: detail.id,
              imageUrl: detail.imageUrl,
              priceCny: detail.priceCny,
              title: detail.title,
            }))}
            type="button"
          >
            <Heart aria-hidden="true" size={16} />
            {favoriteFlag ? "已收藏" : "收藏"}
          </button>
        </div>
        <h1 className="sdk-h5-pdp-title">{detail.title}</h1>
        <p className="sdk-h5-pdp-sales">
          {detail.sales != null ? <span>已售 {detail.sales}</span> : null}
          {maxQuantity != null ? <span> · 库存 {maxQuantity}</span> : null}
          {stockUrgent ? <em className="sdk-h5-pdp-stock-urgent"> · 仅剩 {maxQuantity} 件</em> : null}
          {soldOut ? <em className="sdk-h5-pdp-stock-urgent"> · 暂时售罄</em> : null}
        </p>
      </section>

      {/* 促销领券 */}
      {offers.length > 0 ? (
        <button
          className="sdk-h5-pdp-row"
          onClick={() => setCouponSheetOpen(true)}
          type="button"
        >
          <span className="sdk-h5-pdp-row-label">
            <Ticket aria-hidden="true" size={14} /> 促销
          </span>
          <span className="sdk-h5-pdp-row-value">
            {offers.slice(0, 2).map((offer) => (
              <span className="sdk-h5-pdp-promo-tag" key={offer.id}>
                {offer.discountText || offer.title}
              </span>
            ))}
            {offers.length > 2 ? <span className="sdk-h5-muted">等 {offers.length} 项优惠</span> : null}
          </span>
          <span className="sdk-h5-pdp-row-link">领券</span>
        </button>
      ) : null}

      {/* 送至 */}
      <div className="sdk-h5-pdp-row">
        <span className="sdk-h5-pdp-row-label">
          <MapPin aria-hidden="true" size={14} /> 送至
        </span>
        {delivery ? (
          <span className="sdk-h5-pdp-row-value sdk-h5-pdp-delivery">
            {delivery.addressLine.length > 24 ? `${delivery.addressLine.slice(0, 24)}…` : delivery.addressLine}
            <small>（{delivery.receiverName} 收）</small>
          </span>
        ) : (
          <Link className="sdk-h5-pdp-row-value sdk-h5-pdp-delivery" to="/buyer/addresses">
            请填写收货地址
          </Link>
        )}
        <span className="sdk-h5-pdp-row-link">{soldOut ? "无货" : "有货"}</span>
      </div>

      {/* 规格 */}
      {detail.skus.length > 0 ? (
        <section className="sdk-h5-section">
          <h2>选择规格</h2>
          <div className="sdk-h5-chip-row">
            {detail.skus.map((sku) => (
              <button
                aria-label={`${sku.title}${sku.stock != null ? `，库存 ${sku.stock}` : ""}`}
                className={sku.id === (selectedSku?.id ?? "") ? "sdk-h5-chip sdk-h5-chip-active" : "sdk-h5-chip"}
                key={sku.id}
                onClick={() => selectSku(sku.id)}
                type="button"
              >
                {sku.title}
              </button>
            ))}
          </div>
          <p className="sdk-h5-pdp-selected">
            已选 {selectedSku?.title ?? "默认规格"} × {quantity}
            {selectedSku?.priceCny != null ? <strong>　¥{selectedSku.priceCny.toFixed(2)}</strong> : null}
          </p>
        </section>
      ) : null}

      {/* 数量 */}
      <section className="sdk-h5-section">
        <h2>购买数量</h2>
        <div className="sdk-h5-quantity">
          <button
            aria-label="减少数量"
            disabled={quantity <= 1}
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            type="button"
          >
            −
          </button>
          <span aria-live="polite">{quantity}</span>
          <button
            aria-label="增加数量"
            disabled={maxQuantity != null && quantity >= maxQuantity}
            onClick={() => setQuantity((value) => (maxQuantity != null ? Math.min(maxQuantity, value + 1) : value + 1))}
            type="button"
          >
            +
          </button>
        </div>
        {maxQuantity != null && quantity >= maxQuantity && !soldOut ? (
          <p className="sdk-h5-muted">已达当前规格库存上限</p>
        ) : null}
      </section>

      {/* 店铺 */}
      {detail.shopId ? (
        <Link className="sdk-h5-pdp-row" to={`/shop/${detail.shopId}`}>
          <span className="sdk-h5-pdp-row-label">
            <Home aria-hidden="true" size={14} /> 店铺
          </span>
          <span className="sdk-h5-pdp-row-value">{detail.shopName || detail.shopId}</span>
          <span className="sdk-h5-pdp-row-link">
            进入店铺 <ChevronRight aria-hidden="true" size={12} />
          </span>
        </Link>
      ) : null}

      {/* 规格 */}
      {detail.specs.length > 0 ? (
        <section className="sdk-h5-section">
          <h2>规格参数</h2>
          <dl className="sdk-h5-spec-list">
            {detail.specs.map((spec) => (
              <div key={spec.name}>
                <dt>{spec.name}</dt>
                <dd>{spec.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {/* 商品介绍 */}
      {detail.description ? (
        <section className="sdk-h5-section">
          <h2>商品介绍</h2>
          <p className="sdk-h5-pdp-description">{detail.description}</p>
        </section>
      ) : null}

      {/* 评价 */}
      <section className="sdk-h5-section sdk-h5-pdp-reviews">
        <h2>商品评价</h2>
        <div className="sdk-h5-pdp-reviews-stars" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star key={star} size={16} />
          ))}
        </div>
        <p>评价体系即将上线，下单后可评价晒单。</p>
      </section>

      {/* 看了又看 */}
      {recommendations.length > 0 ? (
        <section className="sdk-h5-section">
          <h2>看了又看</h2>
          <div className="sdk-h5-pdp-recs">
            {recommendations.map((product) => (
              <Link className="sdk-h5-pdp-rec-card" key={product.id} to={`/product/${product.id}`}>
                <div className="sdk-h5-pdp-rec-image">
                  {product.imageUrl ? <img alt={product.title} loading="lazy" src={product.imageUrl} /> : null}
                </div>
                <div className="sdk-h5-pdp-rec-title">{product.title}</div>
                <div className="sdk-h5-pdp-rec-price">
                  {product.priceCny != null ? `¥${product.priceCny.toFixed(2)}` : "询价"}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {message ? <div className="sdk-h5-toast" role="status">{message}</div> : null}
      {toast ? <div className="sdk-h5-toast" role="status">{toast}</div> : null}

      {/* 底部操作栏 */}
      <div className="sdk-h5-pdp-actions">
        <Link aria-label="回到首页" className="sdk-h5-pdp-action-icon" to="/">
          <Home aria-hidden="true" size={20} />
          <span>首页</span>
        </Link>
        <Link aria-label="联系客服" className="sdk-h5-pdp-action-icon" to="/buyer/chat">
          <MessageCircle aria-hidden="true" size={20} />
          <span>客服</span>
        </Link>
        <button
          aria-label={favoriteFlag ? "取消收藏" : "收藏商品"}
          className={favoriteFlag ? "sdk-h5-pdp-action-icon sdk-h5-pdp-action-fav-on" : "sdk-h5-pdp-action-icon"}
          onClick={() => setFavoriteFlag(toggleMallH5Favorite({
            id: detail.id,
            imageUrl: detail.imageUrl,
            priceCny: detail.priceCny,
            title: detail.title,
          }))}
          type="button"
        >
          <Heart aria-hidden="true" size={20} />
          <span>{favoriteFlag ? "已收藏" : "收藏"}</span>
        </button>
        <button
          className="sdk-h5-button sdk-h5-button-secondary sdk-h5-pdp-action-cart"
          disabled={busy || soldOut || !selectedSku}
          onClick={() => void handleAddToCart()}
          type="button"
        >
          <ShoppingCart aria-hidden="true" size={16} /> 加入购物车
        </button>
        <button
          className="sdk-h5-button sdk-h5-button-primary sdk-h5-pdp-action-buy"
          disabled={busy || soldOut || !selectedSku}
          onClick={handleBuyNow}
          type="button"
        >
          {soldOut ? "已售罄" : "立即购买"}
        </button>
      </div>

      {/* 领券面板 */}
      {couponSheetOpen ? (
        <div className="sdk-h5-pdp-sheet-mask" onClick={() => setCouponSheetOpen(false)} onKeyDown={() => {}} role="presentation">
          <div
            className="sdk-h5-pdp-sheet"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={() => {}}
            role="dialog"
            aria-label="领取优惠券"
          >
            <header className="sdk-h5-pdp-sheet-head">
              <strong>领取优惠券</strong>
              <button aria-label="关闭" onClick={() => setCouponSheetOpen(false)} type="button">关闭</button>
            </header>
            {offers.map((offer) => (
              <div className="sdk-h5-pdp-sheet-row" key={offer.id}>
                <div>
                  <div className="sdk-h5-pdp-sheet-title">{offer.title}</div>
                  {offer.discountText ? <div className="sdk-h5-muted">{offer.discountText}</div> : null}
                  {offer.highlight ? <div className="sdk-h5-muted">{offer.highlight}</div> : null}
                </div>
                <button
                  className="sdk-h5-button sdk-h5-button-primary"
                  disabled={claiming}
                  onClick={() => void handleClaim(offer.id)}
                  type="button"
                >
                  领取
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* 全屏看图 */}
      {previewOpen && galleryImages.length > 0 ? (
        <div className="sdk-h5-pdp-preview" onClick={() => setPreviewOpen(false)} onKeyDown={() => {}} role="presentation">
          <button aria-label="关闭大图" className="sdk-h5-pdp-preview-close" onClick={() => setPreviewOpen(false)} type="button">
            关闭
          </button>
          <img alt={`${detail.title} 大图`} src={galleryImages[activeImage]} />
          {galleryImages.length > 1 ? (
            <>
              <button
                aria-label="上一张"
                className="sdk-h5-pdp-preview-nav"
                disabled={activeImage === 0}
                onClick={(event) => {
                  event.stopPropagation();
                  goToImage(activeImage - 1);
                }}
                type="button"
              >
                <ChevronLeft aria-hidden="true" size={22} />
              </button>
              <span className="sdk-h5-pdp-preview-count">
                {activeImage + 1}/{galleryImages.length}
              </span>
              <button
                aria-label="下一张"
                className="sdk-h5-pdp-preview-nav"
                disabled={activeImage === galleryImages.length - 1}
                onClick={(event) => {
                  event.stopPropagation();
                  goToImage(activeImage + 1);
                }}
                type="button"
              >
                <ChevronRight aria-hidden="true" size={22} />
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
