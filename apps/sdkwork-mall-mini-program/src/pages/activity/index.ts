import { errorMessage, type MpTapEvent } from "../../types/common";
import { listActivities, type MpActivity } from "../../services/marketing-service";

interface ActivityRow {
  id: string;
  title: string;
  highlight: string;
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
      wx.navigateTo({ url: `/pages/activity-detail/index?id=${id}` });
    }
  },
});
