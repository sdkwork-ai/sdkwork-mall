import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@sdkwork/ui-pc-react";
import {
  defaultMallCmsConfig,
  readMallCmsConfig,
  type MallCmsConfig,
} from "../cms-config";
import { invalidateMallCmsConfigCache, loadMallCmsConfigRemote, saveMallCmsConfigRemote } from "../cms-service";

export function SdkworkMallAdminCmsPage() {
  const [config, setConfig] = useState<MallCmsConfig>(() => defaultMallCmsConfig());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadMallCmsConfigRemote()
      .then((remoteConfig) => {
        if (active) {
          setConfig(remoteConfig);
        }
      })
      .catch(() => {
        if (active) {
          setConfig(readMallCmsConfig());
        }
      });
    return () => {
      active = false;
    };
  }, []);

  function updateBanner(index: number, field: "title" | "subtitle" | "linkUrl", value: string) {
    setConfig((current) => ({
      ...current,
      banners: current.banners.map((banner, bannerIndex) =>
        bannerIndex === index ? { ...banner, [field]: value } : banner,
      ),
    }));
    setSaved(false);
  }

  function updateFloor(index: number, field: "title" | "productQuery", value: string) {
    setConfig((current) => ({
      ...current,
      floors: current.floors.map((floor, floorIndex) =>
        floorIndex === index ? { ...floor, [field]: value } : floor,
      ),
    }));
    setSaved(false);
  }

  function updateKeyword(index: number, value: string) {
    setConfig((current) => ({
      ...current,
      hotKeywords: current.hotKeywords.map((keyword, keywordIndex) =>
        keywordIndex === index ? { ...keyword, keyword: value } : keyword,
      ),
    }));
    setSaved(false);
  }

  return (
    <div className="sdkwork-mall-pc-cms-admin">
      <header className="sdkwork-mall-pc-page-header">
        <h1>内容 CMS</h1>
        <div className="sdkwork-mall-pc-cms-actions">
          <Link to="/">预览前台</Link>
          <Button
            disabled={saving}
            onClick={() => {
              // A rejected save used to be an unhandled rejection: the operator
              // got no feedback and nothing was persisted.
              setSaving(true);
              setSaveError(null);
              void saveMallCmsConfigRemote(config)
                .then((savedConfig) => {
                  invalidateMallCmsConfigCache();
                  setConfig(savedConfig);
                  setSaved(true);
                })
                .catch((cause: unknown) => {
                  setSaveError(cause instanceof Error ? cause.message : "保存失败，请稍后重试");
                })
                .finally(() => {
                  setSaving(false);
                });
            }}
            type="button"
          >
            {saving ? "保存中..." : "保存配置"}
          </Button>
        </div>
      </header>
      {saved ? <p className="sdkwork-mall-pc-cms-saved">配置已保存。</p> : null}
      {saveError ? (
        <p className="sdkwork-mall-pc-cms-error" role="alert">
          {saveError}
        </p>
      ) : null}

      <section>
        <h2>首页轮播</h2>
        {config.banners.map((banner, index) => (
          <div className="sdkwork-mall-pc-cms-row" key={banner.id}>
            <label>
              标题
              <input onChange={(e) => updateBanner(index, "title", e.target.value)} value={banner.title} />
            </label>
            <label>
              副标题
              <input onChange={(e) => updateBanner(index, "subtitle", e.target.value)} value={banner.subtitle ?? ""} />
            </label>
            <label>
              跳转链接
              <input onChange={(e) => updateBanner(index, "linkUrl", e.target.value)} value={banner.linkUrl} />
            </label>
          </div>
        ))}
      </section>

      <section>
        <h2>首页楼层</h2>
        {config.floors.map((floor, index) => (
          <div className="sdkwork-mall-pc-cms-row" key={floor.id}>
            <label>
              楼层标题
              <input onChange={(e) => updateFloor(index, "title", e.target.value)} value={floor.title} />
            </label>
            <label>
              商品检索词
              <input onChange={(e) => updateFloor(index, "productQuery", e.target.value)} value={floor.productQuery ?? ""} />
            </label>
          </div>
        ))}
      </section>

      <section>
        <h2>热搜关键词</h2>
        {config.hotKeywords.map((keyword, index) => (
          <div className="sdkwork-mall-pc-cms-row" key={keyword.id}>
            <label>
              关键词
              <input onChange={(e) => updateKeyword(index, e.target.value)} value={keyword.keyword} />
            </label>
          </div>
        ))}
      </section>
    </div>
  );
}
