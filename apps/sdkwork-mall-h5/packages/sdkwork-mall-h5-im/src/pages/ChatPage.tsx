import { useCallback, useEffect, useRef, useState } from "react";

import {
  listMallH5ChatConversations,
  listMallH5ChatMessages,
  markMallH5ChatRead,
  sendMallH5ChatMessage,
  type MallH5ChatMessage,
} from "../im-service";
import { formatMallH5Timestamp } from "@sdkwork/mall-h5-commons";

const DEFAULT_CONVERSATION_ID = "cs-conv-1";

export function SdkworkMallH5ChatPage() {
  const [messages, setMessages] = useState<MallH5ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const conversations = await listMallH5ChatConversations();
    const conversation = conversations[0];
    const conversationId = conversation?.id ?? DEFAULT_CONVERSATION_ID;
    const rows = await listMallH5ChatMessages(conversationId);
    setMessages(rows);
    await markMallH5ChatRead(conversationId);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    refresh()
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "会话加载失败");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    // 客服回复轮询：realtime CCP 接入前保持会话新鲜。
    const pollTimer = window.setInterval(() => {
      refresh().catch(() => {
        // 轮询失败静默，下一轮继续。
      });
    }, 5000);
    return () => {
      active = false;
      window.clearInterval(pollTimer);
    };
  }, [refresh]);

  useEffect(() => {
    const node = streamRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages]);

  async function handleSend() {
    const content = draft.trim();
    if (!content || sending) {
      return;
    }
    setSending(true);
    setError(null);
    try {
      await sendMallH5ChatMessage(DEFAULT_CONVERSATION_ID, content);
      setDraft("");
      await refresh();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "发送失败");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="sdk-h5-page sdk-h5-chat">
      {error ? <div className="sdk-h5-error" role="alert">{error}</div> : null}

      <div className="sdk-h5-chat-stream" ref={streamRef}>
        {loading ? <div className="sdk-h5-loading">加载会话...</div> : null}
        {!loading && messages.length === 0 ? (
          <div className="sdk-h5-empty">开始和客服聊聊吧</div>
        ) : null}
        {messages.map((message) => (
          <div
            className={message.role === "buyer" ? "sdk-h5-chat-row sdk-h5-chat-row-buyer" : "sdk-h5-chat-row"}
            key={message.id}
          >
            <div className={message.role === "buyer" ? "sdk-h5-chat-bubble sdk-h5-chat-bubble-buyer" : "sdk-h5-chat-bubble"}>
              <p>{message.content}</p>
              <time>{formatMallH5Timestamp(message.sentAt)}</time>
            </div>
          </div>
        ))}
      </div>

      <div className="sdk-h5-chat-composer">
        <input
          aria-label="输入消息"
          maxLength={500}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void handleSend();
            }
          }}
          placeholder="输入您的问题..."
          value={draft}
        />
        <button
          className="sdk-h5-button sdk-h5-button-primary"
          disabled={sending || !draft.trim()}
          onClick={() => void handleSend()}
          type="button"
        >
          {sending ? "发送中" : "发送"}
        </button>
      </div>
    </div>
  );
}
