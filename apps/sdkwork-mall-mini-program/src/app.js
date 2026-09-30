// SDKWork Mall WeChat mini-program entry.
// Runtime bootstrap lands with the generated mall MP SDK family
// (see docs/decisions.md); pages stay inert until then.
App({
  onLaunch() {
    this.globalData = {
      environment: "development",
      commerceApiBaseUrl: "https://api-dev.sdkwork.com/app/v3/api",
    };
  },
});
