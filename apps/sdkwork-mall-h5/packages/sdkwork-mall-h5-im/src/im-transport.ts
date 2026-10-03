/**
 * Single transport seam for customer-service chat.
 *
 * The generated `@sdkwork/im-app-sdk` app surface ships notifications plus
 * group-chat management; buyer<->agent message streams ride the federation
 * gateway's chat endpoints through this one seam (envelope unwrap and error
 * mapping live here only). When the IM realtime CCP connection is adopted
 * (see apps/sdkwork-mall-h5 docs/decisions.md), send/receive swap to the
 * realtime channel without touching the pages.
 */
import { getSdkworkImChatBaseUrl } from "./im-remote-port";

const DEFAULT_TIMEOUT_MS = 15000;

async function chatRequest(options: {
  path: string;
  method?: string;
  body?: Record<string, unknown>;
}): Promise<unknown> {
  const baseUrl = getSdkworkImChatBaseUrl().replace(/\/+$/u, "");
  const response = await fetch(`${baseUrl}${options.path}`, {
    method: options.method ?? "GET",
    headers: { "content-type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  const payload = (await response.json().catch(() => null)) as
    | { code?: number | string; data?: unknown; message?: string }
    | null;

  if (response.ok && payload && Number(payload.code ?? 0) === 0) {
    return payload.data ?? null;
  }
  throw new Error(
    payload?.message || `客服消息请求失败（HTTP ${response.status}）`,
  );
}

export async function chatGet(path: string): Promise<unknown> {
  return chatRequest({ path });
}

export async function chatPost(
  path: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  return chatRequest({ path, method: "POST", body });
}
