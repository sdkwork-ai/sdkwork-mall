/**
 * H5 i18n runtime (TECH-I18N-READINESS S2 for the H5 root).
 *
 * The catalogue is a plain JSON resource so copy changes are reviewable diffs and
 * a new locale is a resource addition rather than a code change. The default
 * locale stays zh-CN, so shipping this runtime does not change any visible text.
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import zhCN from "./messages.zh-CN.json";

export const SDKWORK_MALL_H5_DEFAULT_LOCALE = "zh-CN";

export const SDKWORK_MALL_H5_I18N_RESOURCES = {
  "zh-CN": { translation: zhCN },
} as const;

void i18n.use(initReactI18next).init({
  fallbackLng: SDKWORK_MALL_H5_DEFAULT_LOCALE,
  interpolation: { escapeValue: false },
  lng: SDKWORK_MALL_H5_DEFAULT_LOCALE,
  resources: SDKWORK_MALL_H5_I18N_RESOURCES,
});

export default i18n;
