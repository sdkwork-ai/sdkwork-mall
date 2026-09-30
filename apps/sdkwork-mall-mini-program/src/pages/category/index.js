// 分类 page. Wired to the generated mall MP SDK once that family lands
// (docs/decisions.md); the view renders the static shell only.
Page({
  data: { title: "分类", ready: false },
  onShow() {
    this.setData({ ready: true });
  },
});
