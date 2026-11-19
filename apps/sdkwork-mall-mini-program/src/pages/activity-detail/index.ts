import { errorMessage } from "../../types/common";
import { t } from "../../i18n";
import { type MpActivity, retrieveActivity } from "../../services/marketing-service";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { buildMpShareCard, buildMpTimelineCard } from "../../utils/share";
import { platform } from "@sdkwork/mall-mp-core";

interface ActivityView extends Omit<MpActivity, "startAt" | "endAt"> {
  windowText: string;
}

interface ActivityDetailData {
  loading: boolean;
  error: string;
  activity: ActivityView | null;
  _eventId: string;
}

function formatTime(iso: string): string {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) {
    return "";
  }
  return new Date(timestamp).toLocaleString("zh-CN");
}

Page({
  data: {
    loading: true,
    error: "",
    activity: null,
    _eventId: "",
  } as ActivityDetailData,

  onLoad(options: Record<string, string | undefined>) {
    this.setData({ _eventId: options.id || "" });
    void this.load(this.data._eventId);
  },

  onShareAppMessage() {
    const activity = this.data.activity;
    return buildMpShareCard({
      query: { id: this.data._eventId },
      routeId: "storefront.mall.activity-detail",
      title: activity ? activity.title : undefined,
    });
  },

  onShareTimeline() {
    const activity = this.data.activity;
    return buildMpTimelineCard({
      query: { id: this.data._eventId },
      routeId: "storefront.mall.activity-detail",
      title: activity ? activity.title : undefined,
    });
  },

  async load(eventId: string) {
    this.setData({ loading: true, error: "" });
    try {
      const activity = await retrieveActivity(eventId);
      if (!activity) {
        this.setData({ activity: null, loading: false });
        return;
      }
      const windowText = [
        activity.startAt ? formatTime(activity.startAt) : "",
        activity.endAt ? formatTime(activity.endAt) : "",
      ].filter(Boolean).join(" ~ ");
      this.setData({
        activity: { ...activity, windowText },
        loading: false,
      });
    } catch (cause) {
      this.setData({
        activity: null,
        error: errorMessage(cause, t("activity.errors.load")),
        loading: false,
      });
    }
  },

  retry() {
    void this.load(this.data._eventId);
  },

  goBrowse() {
    platform.navigateTo(mpCapabilityUrl("storefront.mall.search", { sort: "sales" }));
  },
});
