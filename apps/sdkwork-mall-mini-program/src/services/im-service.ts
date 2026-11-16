/**
 * Messaging surface consumed by the notice and chat pages.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` sections 3-6. The capability
 * lives in `@sdkwork/mall-mp-im`, which projects the SDKWork IM services onto
 * mall view models; this module is the app-root re-export so pages keep a stable
 * import path while the implementation lives in the package.
 */
export {
  disposeRealtime,
  isRealtimeConnected,
  listChatConversations,
  listChatMessages,
  listNotices,
  markChatRead,
  recoverRealtime,
  retrieveNotice,
  sendChatImage,
  sendChatMessage,
  subscribeConversationMessages,
} from "@sdkwork/mall-mp-im/im-service";
export type {
  MpChatConversation,
  MpChatMessage,
  MpImChatImageInput,
  MpNotice,
  MpNoticePage,
} from "@sdkwork/mall-mp-im/im-service";
