import { useEffect, useRef, useState } from "react";
import { useFetcher } from "@remix-run/react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  InlineStack,
  Spinner,
  Text,
  TextField,
  Badge,
  Divider,
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
  const chatPath = `/app/chat/${auditId}?shop=${encodeURIComponent(shopDomain)}`;
  const loaderFetcher = useFetcher<ChatLoaderData>();
  const actionFetcher = useFetcher<ChatActionData>();
  const [inputValue, setInputValue] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load messages on mount
  useEffect(() => {
    loaderFetcher.load(chatPath);
  }, [chatPath]);

  // Merge loader data and optimistic action data
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

  // Auto-scroll to bottom when new messages arrive
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

  const isLoading = loaderFetcher.state === "loading" && messages.length === 0;

  return (
    <Card>
      <BlockStack gap="400">
        {/* Header */}
        <InlineStack align="space-between" blockAlign="center" wrap>
          <BlockStack gap="050">
            <Text as="h2" variant="headingMd">
              AI Report Assistant
            </Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Ask questions about your audit results — impact, priorities, and how to improve
            </Text>
          </BlockStack>
          <Badge tone={auditPlusActive ? "success" : undefined}>
            {`${String(remaining)} / ${String(dailyLimit)} today`}
          </Badge>
        </InlineStack>

        <Divider />

        {/* Error banner */}
        {actionData?.error && (
          <Banner tone="critical">
            <Text as="p" variant="bodyMd">
              {actionData.error}
            </Text>
          </Banner>
        )}

        {/* Messages area */}
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
                No questions yet. Try asking:
              </Text>
              <div className="ld-chat-suggestions">
                <SuggestionChip
                  label="What has the most impact on my SEO?"
                  onClick={() => setInputValue("What has the most impact on my SEO?")}
                />
                <SuggestionChip
                  label="Which issues should I fix first?"
                  onClick={() => setInputValue("Which issues should I fix first?")}
                />
                <SuggestionChip
                  label="How do trust signals affect sales?"
                  onClick={() => setInputValue("How do trust signals affect sales?")}
                />
                <SuggestionChip
                  label="Are my images hurting performance?"
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

          <div ref={chatEndRef} />
        </div>

        <Divider />

        {/* Input area */}
        <BlockStack gap="300">
          {isAtLimit && (
            <Banner tone="warning" title="Daily limit reached">
              <Text as="p" variant="bodyMd">
                You&apos;ve used all {dailyLimit} free messages for today. Upgrade to
                Audit Plus for 50 messages/day and full report access.
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
                  placeholder={
                    auditPlusActive
                      ? "e.g. What should I fix first for better SEO?"
                      : "e.g. Which issues have the most impact?"
                  }
                  multiline={2}
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
        </BlockStack>

        {!auditPlusActive && !isAtLimit && (
          <Text as="p" variant="bodySm" tone="subdued">
            Free plan: {dailyLimit} messages/day. Audit Plus subscribers get 50 messages/day.
          </Text>
        )}
      </BlockStack>
    </Card>
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
        {isUser ? "You" : "AI Assistant"} · {time}
      </Text>
    </div>
  );
}

function SuggestionChip({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="ld-chat-suggestion-chip"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
