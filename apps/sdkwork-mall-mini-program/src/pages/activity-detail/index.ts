import { type MpActivity, retrieveActivity } from "../../services/marketing-service";

interface ActivityView extends Omit<MpActivity, "startAt" | "endAt"> {
  windowText: string;
}

interface ActivityDetailData {
  loading: boolean;
  activity: ActivityView | null;
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
    activity: null,
  } as ActivityDetailData,

  onLoad(options: Record<string, string | undefined>) {
    void this.load(options.id || "");
  },

  async load(eventId: string) {
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
    } catch {
      this.setData({ activity: null, loading: false });
    }
  },
});
