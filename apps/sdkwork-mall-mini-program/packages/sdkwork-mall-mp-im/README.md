# `@sdkwork/mall-mp-im`

Messaging capability for the SDKWork Mall mini program.

Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` sections 3-6.

## Messaging belongs to SDKWork IM

The domain services come from `@sdkwork/im-mp-chat/services`:

| Plane | SDKWork IM service | Generated client |
| --- | --- | --- |
| notice centre | `createImMpNotificationsService` | `@sdkwork/im-app-sdk` `notifications.*` |
| conversation inbox | `createImMpChatInboxService` | `@sdkwork/im-sdk` `conversations.*` |
| messages, send, read cursor | `createImMpChatConversationService` | `@sdkwork/im-sdk` `conversations.*` |
| live messages | `createImMpChatRealtimeService` | `@sdkwork/im-sdk` `connect()` over the host socket |

Realtime facade for pages:

```ts
const release = subscribeConversationMessages(conversationId, () => void refresh());
recoverRealtime();   // app foreground after a background cycle
release();           // onHide / onUnload
```

The page only re-reads the stream; it never maps a decoded wire payload, and the
15 s safety-net poll stays for offline periods.

## Image messages

Bytes and the message record stay separate (`DRIVE_SPEC.md` section 10):

```
host picker -> Drive uploader (injected MpImImageUploader) -> IM conversation.sendImage
```

`sendChatImage(conversationId, { bytes, contentType, fileName, sizeBytes })` uploads
through the injected Drive port and posts the returned
`{ driveUri, spaceId, nodeId, mimeType, sizeBytes }` as a media part. The
capability owns no storage flow; the app bootstrap injects the uploader declared
as `mall.chat-image` in `specs/upload.declaration.json`.

This package only **projects** the IM domain types onto mall view models
(`MpNotice`, `MpChatConversation`, `MpChatMessage`) and orders the chat stream
chronologically. It declares no transport and no endpoint.

## Usage

```ts
// app bootstrap
configureMpImServices(createMpImServices(
  { imAppClient: runtime.imAppClient, imChatClient: runtime.imChatClient },
  { resolveCurrentUserId: () => runtime.session.read()?.userId ?? "" },
));

// pages
import { listNotices, listChatMessages, sendChatMessage } from "@sdkwork/mall-mp-im/im-service";
```

## Rules

- Unwired services throw a readable error instead of rendering an empty inbox.
- The capability never constructs a client, never touches `wx.*`, and never
  calls `/im/chat/*` or `/notifications` itself.
