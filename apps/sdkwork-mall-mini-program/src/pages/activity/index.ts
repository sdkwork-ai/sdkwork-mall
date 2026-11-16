import { errorMessage, type MpTapEvent } from "../../types/common";
import { t } from "../../i18n";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { listActivities, type MpActivity } from "../../services/marketing-service";
import { buildMpShareCard, buildMpTimelineCard } from "../../utils/share";
import { platform } from "@sdkwork/mall-mp-core";

interface ActivityRow {
  id: string;
  title: string;
  highlight: string;
  /** Drives the `activity-<phase>` card modifier used by the stylesheet. */
  phase: MpActivity["phase"];
  phaseText: string;
  windowText: string;
}

interface ActivityData {
  loading: boolean;
  message: string;
  activities: ActivityRow[];
}

const PHASE_TEXTS: Record<MpActivity["phase"], string> = {
  active: "进行中",
  ended: "已结束",
  upcoming: "即将开始",
};

function formatTime(iso: string): string {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) {
    return "";
  }
  const at = new Date(timestamp);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${at.getMonth() + 1}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

function toRows(activities: MpActivity[]): ActivityRow[] {
  return activities.map((activity) => ({
    id: activity.id,
    title: `${activity.typeLabel} · ${activity.title}`,
    highlight: activity.highlight || activity.discountText,
    phase: activity.phase,
    phaseText: PHASE_TEXTS[activity.phase],
    windowText: [
      activity.startAt ? formatTime(activity.startAt) : "",
      activity.endAt ? formatTime(activity.endAt) : "",
    ].filter(Boolean).join(" ~ "),
  }));
}

Page({
  data: {
    loading: true,
    message: "",
    activities: [],
  } as ActivityData,

  onShow() {
    void this.load();
  },

  async load() {
    this.setData({ loading: true, message: "" });
    try {
      const activities = await listActivities();
      this.setData({ activities: toRows(activities), loading: false });
    } catch (cause) {
      this.setData({ loading: false, message: errorMessage(cause, "活动加载失败") });
    }
  },

  goDetail(event: MpTapEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    if (id) {
      platform.navigateTo(mpCapabilityUrl("storefront.mall.activity-detail", { id: id }));
    }
  },

  onShareAppMessage() {
    return buildMpShareCard({
      routeId: "storefront.mall.activity-list",
      title: t("activity.hallTitle"),
    });
  },

  onShareTimeline() {
    return buildMpTimelineCard({
      routeId: "storefront.mall.activity-list",
      title: t("activity.hallTitle"),
    });
  },

  retry() {
    void this.load();
  },

  onPullDownRefresh() {
    void this.load().finally(() => platform.stopPullDownRefresh());
  },
});
