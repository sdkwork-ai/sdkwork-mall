/**
 * Contracts for the mall account and messaging capabilities.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 6 (capabilities call
 * injected clients/services). Authentication is delegated to `sdkwork-iam`,
 * messaging to `sdkwork-im`; these tests fake the domain clients so the mall-side
 * projection and wiring are what is under test.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { createMpAuthService } from "@sdkwork/mall-mp-auth";
import {
  configureMpImServices,
  createMpImServices,
  listChatConversations,
  listChatMessages,
  listNotices,
  markChatRead,
  retrieveNotice,
  sendChatMessage,
} from "@sdkwork/mall-mp-im/im-service";
import {
  createIamMpWechatSessionManager,
  initializeMallMpRuntime,
  resetMallMpRuntime,
  type IamAppSdkClient,
  type IamMpWechatSessionManager,
  type ImAppSdkClient,
  type ImChatSdkClient,
  type MallMpRuntime,
} from "@sdkwork/mall-mp-core";
import { createMemoryHost } from "@sdkwork/mall-mp-host/testing";

function envelope(data: unknown) {
  return { code: 0, data, traceId: "trace-1" };
}

function createRuntime(httpResponses: Parameters<typeof createMemoryHost>[0]["httpResponses"] = []) {
  resetMallMpRuntime();
  const host = createMemoryHost({ httpResponses, loginCodes: ["wx-code-1"] });
  return initializeMallMpRuntime({
    environment: {
      appApiBaseUrl: "https://api.test/app/v3/api",
      environment: "development",
      deploymentProfile: "standalone",
      profileId: "standalone.development",
      surfaceCode: "mall-mini-program",
    },
    host,
  });
}

/**
 * Replaces the IAM client (and therefore the session manager built from it) so
 * the WeChat exchange can be asserted without a network call.
 */
function withFakeIam(
  runtime: MallMpRuntime,
  loginResponse: unknown,
  overrides: { retrieve?: () => Promise<unknown>; remove?: () => Promise<unknown> } = {},
): { runtime: MallMpRuntime; lastExchangeBody: () => Record<string, unknown> | null } {
  let exchangeBody: Record<string, unknown> | null = null;
  const fakeClient = {
    oauth: {
      miniProgramSessions: {
        create: async (body: Record<string, unknown>) => {
          exchangeBody = body;
          return loginResponse;
        },
      },
    },
    auth: {
      sessions: {
        current: {
          retrieve: overrides.retrieve ?? (async () => ({})),
          delete: overrides.remove ?? (async () => undefined),
        },
      },
    },
  };
  const iamClient = fakeClient as unknown as IamAppSdkClient;
  const authManager: IamMpWechatSessionManager = createIamMpWechatSessionManager({
    client: fakeClient as never,
    store: runtime.session,
    ...(runtime.environment.surfaceCode ? { surfaceCode: runtime.environment.surfaceCode } : {}),
  });
  return {
    runtime: Object.assign({}, runtime, { iamClient, authManager }) as MallMpRuntime,
    lastExchangeBody: () => exchangeBody,
  };
}

describe("account capability (sdkwork-iam integration)", () => {
  beforeEach(() => {
    resetMallMpRuntime();
  });

  it("signs in with the WeChat code through the IAM session module", async () => {
    const { runtime, lastExchangeBody } = withFakeIam(createRuntime(), {
      accessToken: "access-wx",
      authToken: "auth-wx",
      expiresIn: 3600,
      userId: "user-wx",
    });
    const service = createMpAuthService(runtime);

    const snapshot = await service.loginWithWechat();

    expect(snapshot).toMatchObject({ accessToken: "access-wx", authToken: "auth-wx", userId: "user-wx" });
    expect(runtime.session.isAuthenticated()).toBe(true);
    expect(lastExchangeBody()).toMatchObject({
      jsCode: "wx-code-1",
      providerCode: "wechat_mini_program",
      surfaceCode: "mall-mini-program",
    });
    expect(lastExchangeBody()?.deviceId).toBeTruthy();
  });

  it("keeps the account/password fallback on the IAM session contract", async () => {
    const runtime = createRuntime([{
      statusCode: 200,
      header: {},
      data: envelope({ accessToken: "access-pw", authToken: "auth-pw", context: { userId: "user-pw" } }),
    }]);
    const service = createMpAuthService(runtime);

    const snapshot = await service.loginWithPassword({ account: "buyer@example.com", password: "secret" });

    expect(snapshot).toMatchObject({ accessToken: "access-pw", authToken: "auth-pw", userId: "user-pw" });
    expect(runtime.host.recorder.http[0].url).toBe("https://api.test/app/v3/api/auth/sessions");
    expect(runtime.host.recorder.http[0].data).toEqual({ password: "secret", email: "buyer@example.com" });
  });

  it("rejects a session-create response without a token", async () => {
    const runtime = createRuntime([{ statusCode: 200, header: {}, data: envelope({ accessToken: "a" }) }]);
    const service = createMpAuthService(runtime);

    await expect(service.loginWithPassword({ account: "13800000000", password: "secret" }))
      .rejects.toThrow("登录响应缺少令牌");
  });

  it("clears the session on logout even when the server revoke fails", async () => {
    const base = createRuntime();
    base.session.write({ accessToken: "access-1", authToken: "auth-1" });
    const { runtime } = withFakeIam(base, {}, {
      remove: async () => {
        throw new Error("offline");
      },
    });

    await createMpAuthService(runtime).logout();

    expect(runtime.session.read()).toBeNull();
  });

  it("restores a validated session and clears a rejected one", async () => {
    const base = createRuntime();
    base.session.write({ accessToken: "access-1", authToken: "auth-1" });

    const validated = withFakeIam(base, {}).runtime;
    expect((await createMpAuthService(validated).restore()).reason).toBe("restored");

    const rejected = withFakeIam(base, {}, {
      retrieve: async () => {
        throw Object.assign(new Error("unauthorized"), { statusCode: 401 });
      },
    }).runtime;
    const result = await createMpAuthService(rejected).restore();
    expect(result).toMatchObject({ authenticated: false, reason: "rejected" });
    expect(base.session.read()).toBeNull();
  });
});

describe("messaging capability (sdkwork-im integration)", () => {
  beforeEach(() => {
    configureMpImServices(null);
  });

  it("fails loudly when the IM services were never wired", async () => {
    await expect(listNotices()).rejects.toThrow("IM services are not configured");
  });

  it("projects the IM notice centre onto mall view models", async () => {
    const notifications = {
      list: async () => ({
        items: [{
          notificationId: "n-1",
          category: "trade",
          title: "订单已发货",
          body: "您的订单已发出",
          status: "unread",
          requestedAt: "2026-11-16T10:00:00Z",
        }],
        pageInfo: { mode: "cursor", hasMore: true, nextCursor: "cursor-2" },
      }),
      retrieve: async () => ({ item: { notificationId: "n-1", title: "订单已发货", body: "详情" } }),
    };
    configureMpImServices(createMpImServices({
      imAppClient: { notifications } as unknown as ImAppSdkClient,
      imChatClient: { conversations: {} } as unknown as ImChatSdkClient,
    }));

    const page = await listNotices();
    expect(page.nextCursor).toBe("cursor-2");
    expect(page.items[0]).toMatchObject({ notificationId: "n-1", category: "trade", status: "unread" });

    const notice = await retrieveNotice("n-1");
    expect(notice).toMatchObject({ notificationId: "n-1", body: "详情" });
  });

  it("projects the IM inbox and conversation services onto mall view models", async () => {
    const runtime = createRuntime();
    runtime.session.write({ accessToken: "a", authToken: "b", userId: "user-1" });
    expect(runtime.session.read()?.userId).toBe("user-1");

    const sent: Array<[string, string]> = [];
    const read: string[] = [];
    const conversations = {
      list: async () => ({
        items: [{
          conversationId: "c-1",
          conversationType: "direct",
          displayName: "官方客服",
          lastSummary: "在的",
          lastActivityAt: "2026-11-16T10:00:00Z",
          unreadCount: 2,
          lastMessageSeq: "9",
        }],
        pageInfo: { mode: "cursor", hasMore: false },
      }),
      // Raw `ConversationMessageEntry` shape: the IM service owns the projection
      // onto `ImMpChatMessageItem` (sender sub-record, body parts, seq).
      listMessages: async () => ({
        items: [{
          messageId: "m-1",
          body: { text: "你好" },
          sender: { id: "user-1", displayName: "买家" },
          occurredAt: "2026-11-16T10:00:00Z",
          messageSeq: "7",
        }, {
          messageId: "m-2",
          body: { text: "在的" },
          sender: { id: "agent-9", displayName: "客服" },
          occurredAt: "2026-11-16T10:01:00Z",
          messageSeq: "8",
        }],
        hasMore: false,
        highWatermark: "8",
        pageInfo: { mode: "cursor", hasMore: false },
      }),
      postText: async (conversationId: string, text: string) => {
        sent.push([conversationId, text]);
        return { messageId: "m-3", messageSeq: "10", deliveryStatus: "applied" };
      },
      updateReadCursor: async (conversationId: string) => {
        read.push(conversationId);
      },
      // The IM service always clears the marked-unread flag after advancing the
      // cursor; with no `readSeq` from mall this is the only write of the pair.
      updatePreferences: async (conversationId: string) => {
        read.push(conversationId);
      },
    };
    configureMpImServices(createMpImServices(
      {
        imAppClient: { notifications: { list: async () => ({ items: [] }), retrieve: async () => null } } as unknown as ImAppSdkClient,
        imChatClient: { conversations } as unknown as ImChatSdkClient,
      },
      { resolveCurrentUserId: () => runtime.session.read()?.userId ?? "" },
    ));

    const inbox = await listChatConversations();
    expect(inbox[0]).toMatchObject({ id: "c-1", title: "官方客服", lastMessage: "在的", unread: 2 });

    const messages = await listChatMessages("c-1");
    // The IM services own history paging; the mall stream is chronological.
    expect(messages.map((message) => message.role)).toEqual(["user", "agent"]);
    expect(messages[1]).toMatchObject({ id: "m-2", content: "在的" });

    await sendChatMessage("c-1", "请问什么时候发货");
    await markChatRead("c-1");
    expect(sent).toEqual([["c-1", "请问什么时候发货"]]);
    expect(read).toEqual(["c-1"]);
  });
});
