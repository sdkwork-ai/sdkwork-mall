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
