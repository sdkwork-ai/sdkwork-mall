/**
 * `@sdkwork/mall-mp-im` public surface.
 *
 * Messaging capability: the sdkwork-im notice centre and chat services projected
 * onto mall view models. The app bootstrap composes the IM services from the
 * generated clients; pages consume this facade.
 */
export {
  configureMpImServices,
  createMpImServices,
  disposeRealtime,
  isRealtimeConnected,
  listChatConversations,
  listChatMessages,
  listNotices,
  markChatRead,
  recoverRealtime,
  resolveChatImageUrl,
  retrieveNotice,
  sendChatImage,
  sendChatMessage,
  subscribeConversationMessages,
  type MpChatConversation,
  type MpChatMessage,
  type MpImChatImageInput,
  type MpImChatImageUpload,
  type MpImImageUploader,
  type MpImImageUrlResolver,
  type MpImServices,
  type MpNotice,
  type MpNoticePage,
} from "./services/im-service";
