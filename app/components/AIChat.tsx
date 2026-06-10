import { useEffect, useRef, useState } from "react";
import { useFetcher } from "@remix-run/react";
import {
  Banner,
  BlockStack,
  Button,
  InlineStack,
  Spinner,
  Text,
  TextField,
  Badge,
} from "@shopify/polaris";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type ChatLoaderData = {
  messages: ChatMessage[];
  todayUsage: number;
  dailyLimit: number;
  auditPlusActive: boolean;
  auditStatus: string;
};

type ChatActionData = {
  error?: string;
  userMessage?: ChatMessage;
  assistantMessage?: ChatMessage;
  todayUsage?: number;
  dailyLimit?: number;
};

export function AIChat({
  auditId,
  shopDomain,
  auditPlusActive,
}: {
  auditId: string;
  shopDomain: string;
  auditPlusActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const chatPath = `/app/chat/${auditId}?shop=${encodeURIComponent(shopDomain)}`;
  const loaderFetcher = useFetcher<ChatLoaderData>();
  const actionFetcher = useFetcher<ChatActionData>();
  const [inputValue, setInputValue] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load messages when panel opens
  useEffect(() => {
    if (open) {
      loaderFetcher.load(chatPath);
    }
  }, [open, chatPath]);

  const loaderData = loaderFetcher.data;
  const actionData = actionFetcher.data;
  const isSending = actionFetcher.state === "submitting";

  const messages: ChatMessage[] = [
    ...(loaderData?.messages ?? []),
    ...(actionData?.userMessage ? [actionData.userMessage] : []),
    ...(actionData?.assistantMessage ? [actionData.assistantMessage] : []),
  ];

  const todayUsage = actionData?.todayUsage ?? loaderData?.todayUsage ?? 0;
  const dailyLimit = actionData?.dailyLimit ?? loaderData?.dailyLimit ?? 5;
  const remaining = Math.max(0, dailyLimit - todayUsage);
  const isAtLimit = remaining === 0 && !auditPlusActive;
  const isLoading = loaderFetcher.state === "loading" && messages.length === 0;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = () => {
    if (!inputValue.trim() || isSending) return;
    const formData = new FormData();
    formData.set("message", inputValue.trim());
    actionFetcher.submit(formData, { method: "post", action: chatPath });
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating bubble button */}
      <button
        type="button"
        className={`ld-chat-bubble-btn ${open ? "ld-chat-bubble-btn--hidden" : ""}`}
        onClick={() => setOpen(true)}
        aria-label="Open AI chat"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span>Ask AI</span>
      </button>

      {/* Slide-in panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="ld-chat-backdrop"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="ld-chat-panel">
            {/* Header */}
            <div className="ld-chat-panel-header">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="050">
                  <Text as="h2" variant="headingMd">
                    AI Report Assistant
                  </Text>
                  <Text as="span" variant="bodySm" tone="subdued">
                    Ask about your audit findings
                  </Text>
                </BlockStack>
                <InlineStack gap="200" blockAlign="center">
                  <Badge tone={auditPlusActive ? "success" : undefined}>
                    {`${String(remaining)}/${String(dailyLimit)}`}
                  </Badge>
                  <button
                    type="button"
                    className="ld-chat-close-btn"
                    onClick={() => setOpen(false)}
                    aria-label="Close chat"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </InlineStack>
              </InlineStack>
            </div>

            {/* Messages */}
            <div className="ld-chat-messages">
              {isLoading && (
                <div className="ld-chat-loading">
                  <Spinner accessibilityLabel="Loading chat" size="small" />
                  <Text as="span" variant="bodyMd" tone="subdued">
                    Loading conversation…
                  </Text>
                </div>
              )}

              {!isLoading && messages.length === 0 && (
                <div className="ld-chat-empty">
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Ask me about your audit — impact, priorities, SEO, or anything else.
                  </Text>
                  <div className="ld-chat-suggestions">
                    <SuggestionChip
                      label="What impacts my SEO most?"
                      onClick={() => setInputValue("What impacts my SEO most?")}
                    />
                    <SuggestionChip
                      label="Which issues to fix first?"
                      onClick={() => setInputValue("Which issues should I fix first?")}
                    />
                    <SuggestionChip
                      label="Do trust signals matter?"
                      onClick={() => setInputValue("How do trust signals affect sales?")}
                    />
                    <SuggestionChip
                      label="Are my images too heavy?"
                      onClick={() => setInputValue("Are my images hurting performance?")}
                    />
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <ChatBubble key={msg.id} message={msg} />
              ))}

              {isSending && actionData?.userMessage && !actionData?.assistantMessage && (
                <div className="ld-chat-bubble ld-chat-bubble--assistant ld-chat-typing">
                  <Spinner accessibilityLabel="AI is thinking" size="small" />
                  <Text as="span" variant="bodyMd" tone="subdued">
                    Analyzing your report…
                  </Text>
                </div>
              )}

              {actionData?.error && (
                <Banner tone="critical">
                  <Text as="p" variant="bodyMd">
                    {actionData.error}
                  </Text>
                </Banner>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="ld-chat-panel-footer">
              {isAtLimit && (
                <Banner tone="warning" title="Daily limit reached">
                  <Text as="p" variant="bodyMd">
                    {dailyLimit} messages/day used. Upgrade to Audit Plus for 50/day.
                  </Text>
                </Banner>
              )}

              {!isAtLimit && (
                <InlineStack gap="200" blockAlign="end">
                  <div style={{ flex: 1 }} onKeyDown={handleKeyDown}>
                    <TextField
                      label="Ask about your audit"
                      labelHidden
                      value={inputValue}
                      onChange={setInputValue}
                      placeholder="Ask about your audit…"
                      autoComplete="off"
                      disabled={isSending}
                      maxLength={4000}
                    />
                  </div>
                  <Button
                    variant="primary"
                    onClick={handleSend}
                    loading={isSending}
                    disabled={!inputValue.trim() || isSending}
                  >
                    Send
                  </Button>
                </InlineStack>
              )}

              {!auditPlusActive && !isAtLimit && (
                <Text as="p" variant="bodySm" tone="subdued">
                  Free: {dailyLimit}/day · Audit Plus: 50/day
                </Text>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const time = new Date(message.createdAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`ld-chat-bubble ${isUser ? "ld-chat-bubble--user" : "ld-chat-bubble--assistant"}`}>
      <div className="ld-chat-bubble-content">
        <Text as="p" variant="bodyMd">
          {message.content}
        </Text>
      </div>
      <Text as="span" variant="bodySm" tone="subdued">
        {isUser ? "You" : "AI"} · {time}
      </Text>
    </div>
  );
}

function SuggestionChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="ld-chat-suggestion-chip" onClick={onClick}>
      {label}
    </button>
  );
}
