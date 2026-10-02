/**
 * Single transport seam for the mini-program.
 *
 * Every network call in the app funnels through `request()` so envelope
 * unwrapping, auth headers, timeouts, and error mapping live in exactly one
 * place. Pages and services never call wx.request directly.
 */
const session = require("./session");

const DEFAULT_TIMEOUT_MS = 15000;

function getBaseUrl() {
  const app = getApp();
  return (app && app.globalData && app.globalData.commerceApiBaseUrl) || "https://api-dev.sdkwork.com/app/v3/api";
}

/**
 * Performs a request against the commerce app-api and unwraps the
 * SdkWorkApiResponse envelope (`{ code, data, traceId }`).
 * HTTP/problem errors reject with an Error carrying `.code` and `.traceId`.
 */
function request(options) {
  const { path, method = "GET", body, query, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  let url = `${getBaseUrl()}${path}`;
  if (query) {
    const search = Object.keys(query)
      .filter((key) => query[key] !== undefined && query[key] !== null && query[key] !== "")
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
      .join("&");
    if (search) {
      url += `?${search}`;
    }
  }

  const header = { "content-type": "application/json" };
  const token = session.getToken();
  if (token) {
    header.authorization = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data: body,
      header,
      timeout: timeoutMs,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const payload = res.data;
          if (payload && typeof payload === "object" && "code" in payload) {
            if (Number(payload.code) === 0) {
              resolve(payload.data);
              return;
            }
            const error = new Error(payload.message || `请求失败（${payload.code}）`);
            error.code = payload.code;
            error.traceId = payload.traceId;
            reject(error);
            return;
          }
          resolve(payload);
          return;
        }
        const problem = res.data || {};
        const error = new Error(
          problem.detail || problem.title || problem.message || `请求失败（HTTP ${res.statusCode}）`,
        );
        error.code = problem.code ?? res.statusCode;
        error.traceId = problem.traceId;
        error.statusCode = res.statusCode;
        reject(error);
      },
      fail(cause) {
        const error = new Error(cause && cause.errMsg ? `网络请求失败：${cause.errMsg}` : "网络请求失败");
        error.cause = cause;
        reject(error);
      },
    });
  });
}

module.exports = { request };
