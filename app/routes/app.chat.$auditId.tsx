import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { hasAuditPlus } from "../lib/billing.server";
import { guardChatInput, getConversationSizeLimit } from "../lib/chat-guardrails.server";

const FREE_DAILY_LIMIT = 5;
const PRO_DAILY_LIMIT = 50;

async function getTodayUsage(storeId: string): Promise<number> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const record = await prisma.aIChatUsage.findUnique({
    where: { storeId_date: { storeId, date: today } },
  });
  return record?.count ?? 0;
}

async function incrementUsage(storeId: string): Promise<number> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const record = await prisma.aIChatUsage.upsert({
    where: { storeId_date: { storeId, date: today } },
    create: { storeId, date: today, count: 1 },
    update: { count: { increment: 1 } },
  });
  return record.count;
}

/**
 * Build the system prompt from the current audit findings.
 * Categories mirror the report tabs: Payments, Shipping, Products, SEO,
 * Trust, Checkout, Mobile & Theme.
 */
function buildSystemPrompt(
  findings: Array<{ ruleCode: string; severity: string; category: string; title: string; body: string }>,
): string {
  const CATEGORY_LABEL: Record<string, string> = {
    PAYMENTS_FRAUD: "Payments & fraud",
    SHIPPING_FULFILLMENT: "Shipping & fulfillment",
    PRODUCT_CATALOG: "Product catalog quality",
    SEO_DISCOVERABILITY: "SEO & discoverability",
    TRUST_SIGNALS: "Trust signals",
    CHECKOUT_CONVERSION: "Checkout & conversion",
    MOBILE_THEME: "Mobile & theme",
  };

  const byCategory: Record<string, typeof findings> = {};
  for (const f of findings) {
    (byCategory[f.category] ??= []).push(f);
  }

  const parts: string[] = [
    "You are Launch Doctor's AI assistant. A Shopify merchant just ran a store audit. Below are ALL findings from their report. Answer their questions using ONLY these findings — do not invent issues the audit didn't flag.",
    "",
    "=== AUDIT FINDINGS ===",
  ];

  for (const [cat, items] of Object.entries(byCategory)) {
    const label = CATEGORY_LABEL[cat] ?? cat;
    const critical = items.filter((f) => f.severity === "CRITICAL").length;
    const high = items.filter((f) => f.severity === "HIGH").length;
    parts.push(`\n## ${label} (${items.length} issues: ${critical} critical, ${high} high)`);
    for (const f of items) {
      parts.push(`  [${f.severity}] ${f.title}: ${f.body}`);
    }
  }

  parts.push(
    "",
    "=== GUIDELINES ===",
    "- Explain impact in plain language. Merchants are busy, not technical.",
    "- Critical = directly blocks sales or payments. High = hurts trust/discoverability but won't block sales today.",
    "- Medium/Low = polish items — fix when time allows.",
    "- For SEO questions: explain what Google cares about most (sitemap > meta tags > images > alt text).",
    "- For priority questions: always rank criticals first, then highs, then mediums.",
    "- If the merchant asks something the audit doesn't cover, say so honestly.",
    "- Be concise. Bullet points when listing items.",
    "- Never suggest code execution, scripts, or anything that modifies the store directly.",
  );

  return parts.join("\n");
}

async function callAI(
  userMessage: string,
  systemPrompt: string,
  conversationHistory: Array<{ role: string; content: string }>,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL ?? "openrouter/free";

  if (!apiKey) {
    // Fall back to mock if no API key configured
    return mockResponse(userMessage, systemPrompt);
  }

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...conversationHistory,
    { role: "user" as const, content: userMessage },
  ];

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL ?? "https://launch-doctor.fly.dev",
        "X-Title": "Launch Doctor",
      },
      body: JSON.stringify({ model, messages, max_tokens: 800, temperature: 0.7 }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[chat] OpenRouter error ${res.status}: ${text.slice(0, 300)}`);
      return mockResponse(userMessage, systemPrompt);
    }

    const json = await res.json();
    return json.choices?.[0]?.message?.content ?? mockResponse(userMessage, systemPrompt);
  } catch (error) {
    console.error("[chat] OpenRouter fetch failed:", error);
    return mockResponse(userMessage, systemPrompt);
  }
}

/** Fallback mock response when the API is unavailable. */
function mockResponse(userMessage: string, systemPrompt: string): string {
  const criticalCount = (systemPrompt.match(/CRITICAL/g) ?? []).length;
  const highCount = (systemPrompt.match(/HIGH/g) ?? []).length;

  const lower = userMessage.toLowerCase();

  if (lower.includes("seo") || lower.includes("rank") || lower.includes("google") || lower.includes("traffic")) {
    return `SEO is driven by several factors. Here's what matters most from your audit:\n\n**Highest SEO Impact:**\n- Missing meta descriptions and title tags (direct ranking signals)\n- No XML sitemap (Google can't discover all your pages)\n- Heavy images (slow pages hurt rankings)\n\n**Tip:** Fix critical issues first — a single missing sitemap can hurt more than ten minor image issues.`;
  }

  if (lower.includes("impact") || lower.includes("priority") || lower.includes("important") || lower.includes("most")) {
    if (criticalCount > 0) {
      return `The **${criticalCount} critical findings** have the highest business impact. Critical issues directly affect revenue — like blocked payments, broken checkout, or invisible products. Fix these before anything else.\n\n**${highCount} high-severity findings** come next — they affect trust and discoverability but won't immediately block sales.\n\nThink of it this way: a store with no payment issues but slow images will still sell. A store with broken payments won't. Always prioritize criticals.`;
    }
    return `Your audit has ${highCount} high-severity findings but no critical ones. Focus on trust signals (About, Contact, reviews) and SEO basics (meta descriptions, sitemap) — these have the biggest long-term impact on organic traffic and conversion.`;
  }

  if (lower.includes("trust") || lower.includes("about") || lower.includes("contact") || lower.includes("reviews")) {
    return `Trust signals are essential for conversion:\n\n- Missing About/Contact pages make your store look less legitimate.\n- Product reviews add social proof (stores with reviews convert 270% better).\n- Broken social links suggest an inactive business.\n\nEven a simple About page with your story and a Contact page with an email can boost conversion by 10-20%.`;
  }

  return `Based on your audit report with ${criticalCount + highCount}+ findings:\n\n**Start with critical issues** — these directly affect whether customers can pay you or find your products.\n\n**Then tackle SEO** — meta descriptions, sitemaps, and images improve Google rankings over time.\n\n**Trust signals build conversion** — About, Contact, and reviews help customers feel confident.\n\nWhich category would you like me to dive deeper into? (SEO, payments, shipping, trust, or something else?)`;
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const auditId = params.auditId;
  if (!auditId) {
    throw new Response("Audit ID required", { status: 400 });
  }

  const store = await prisma.store.findUnique({ where: { shopDomain: session.shop } });
  if (!store) {
    throw new Response("Store not found", { status: 404 });
  }

  const audit = await prisma.audit.findFirst({
    where: { id: auditId, storeId: store.id },
    select: { id: true, status: true },
  });
  if (!audit) {
    throw new Response("Audit not found", { status: 404 });
  }

  const messages = await prisma.aIChatMessage.findMany({
    where: { storeId: store.id, auditId },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true, createdAt: true },
    take: getConversationSizeLimit(),
  });

  const todayUsage = await getTodayUsage(store.id);
  const auditPlusActive = await hasAuditPlus(store.id);
  const dailyLimit = auditPlusActive ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;

  return json({
    messages,
    todayUsage,
    dailyLimit,
    auditPlusActive,
    auditStatus: audit.status,
  });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const auditId = params.auditId;
  if (!auditId) {
    return json({ error: "Audit ID required" }, { status: 400 });
  }

  const store = await prisma.store.findUnique({ where: { shopDomain: session.shop } });
  if (!store) {
    return json({ error: "Store not found" }, { status: 404 });
  }

  const audit = await prisma.audit.findFirst({
    where: { id: auditId, storeId: store.id, status: "COMPLETED" },
    include: {
      findings: {
        select: { ruleCode: true, severity: true, category: true, title: true, body: true },
        orderBy: [{ severity: "asc" }, { ruleId: "asc" }],
      },
    },
  });
  if (!audit) {
    return json({ error: "Completed audit not found. Chat is only available for completed audits." }, { status: 404 });
  }

  const auditPlusActive = await hasAuditPlus(store.id);
  const dailyLimit = auditPlusActive ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;
  const todayUsage = await getTodayUsage(store.id);
  if (todayUsage >= dailyLimit) {
    return json({
      error: `Daily chat limit reached (${dailyLimit} messages/day${auditPlusActive ? "" : " — upgrade to Audit Plus for 50/day"}).`,
      todayUsage,
      dailyLimit,
    }, { status: 429 });
  }

  const messageCount = await prisma.aIChatMessage.count({
    where: { storeId: store.id, auditId },
  });
  if (messageCount >= getConversationSizeLimit()) {
    return json({ error: "Conversation limit reached. Start a new audit to continue chatting." }, { status: 400 });
  }

  const formData = await request.formData();
  const rawMessage = String(formData.get("message") ?? "").trim();
  const guardResult = guardChatInput(rawMessage);

  if (!guardResult.allowed) {
    return json({ error: guardResult.reason }, { status: 400 });
  }

  const userMessage = await prisma.aIChatMessage.create({
    data: {
      storeId: store.id,
      auditId,
      role: "user",
      content: guardResult.sanitized,
    },
  });

  const newCount = await incrementUsage(store.id);

  // Build system prompt from audit findings
  const systemPrompt = buildSystemPrompt(audit.findings);

  // Load recent conversation history for context (last 20 messages)
  const recentMessages = await prisma.aIChatMessage.findMany({
    where: { storeId: store.id, auditId },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
    take: 20,
  });
  const conversationHistory = recentMessages.map((m) => ({
    role: m.role === "assistant" ? "assistant" as const : "user" as const,
    content: m.content,
  }));

  // Call AI (placeholder until OpenRouter API key is added)
  const aiResponse = await callAI(guardResult.sanitized, systemPrompt, conversationHistory);

  const assistantMessage = await prisma.aIChatMessage.create({
    data: {
      storeId: store.id,
      auditId,
      role: "assistant",
      content: aiResponse,
    },
  });

  return json({
    userMessage: {
      id: userMessage.id,
      role: "user",
      content: userMessage.content,
      createdAt: userMessage.createdAt,
    },
    assistantMessage: {
      id: assistantMessage.id,
      role: "assistant",
      content: assistantMessage.content,
      createdAt: assistantMessage.createdAt,
    },
    todayUsage: newCount,
    dailyLimit,
  });
};
