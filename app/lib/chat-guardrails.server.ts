/**
 * AI Chat guardrails — prompt injection detection, base64 blocking,
 * input sanitization, and rate limiting.
 */

const MAX_MESSAGE_LENGTH = 4000;
const MAX_CONVERSATION_MESSAGES = 40;

const PROMPT_INJECTION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|directives?|prompts?|rules?)/i, label: "instruction override" },
  { pattern: /forget\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|directives?)/i, label: "instruction forget" },
  { pattern: /\bsystem\s*:\s*(you\s+(are|must|should|will)|now|new|override)/i, label: "system prompt injection" },
  { pattern: /\[system\]\s*\(#?.+\)/i, label: "bracketed system injection" },
  { pattern: /<\|im_start\|>/i, label: "token delimiter injection" },
  { pattern: /<\|im_end\|>/i, label: "token delimiter injection" },
  { pattern: /你\s*(现在|必须|忽略).*(指令|规则|角色)/i, label: "chinese injection" },
  { pattern: /your\s+new\s+name\s+is/i, label: "role rename" },
  { pattern: /from\s+now\s+on\s+(you|your)\s+(are|will|respond)/i, label: "role override" },
  { pattern: /act\s+as\s+(if\s+you\s+are|a\s+different)/i, label: "act-as injection" },
  { pattern: /you\s+are\s+now\s+(DAN|jailbroken|unfiltered|unrestricted)/i, label: "jailbreak persona" },
  { pattern: /pretend\s+(you\s+are|to\s+be)\s+(a|an|the)/i, label: "pretend injection" },
  { pattern: /do\s+not\s+follow\s+(your\s+)?(instructions?|guidelines?|rules?)/i, label: "instruction bypass" },
  { pattern: /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions?|content)/i, label: "instruction disregard" },
  { pattern: /reveal\s+(your|the)\s+(system\s+)?(prompt|instructions?|rules?|guidelines?)/i, label: "prompt extraction" },
  { pattern: /write\s+(out|down)\s+(your|the)\s+(system\s+)?(prompt|instructions?)/i, label: "prompt extraction" },
  { pattern: /tell\s+me\s+(your|the)\s+(system\s+)?(prompt|instructions?)/i, label: "prompt extraction" },
  { pattern: /\bDAN\b.*\b(do\s+anything\s+now|jailbreak)\b/i, label: "DAN jailbreak" },
  { pattern: /--.*--/i, label: "SQL-style comment injection" },
  { pattern: /<\s*(script|iframe|object|embed|style)\b/i, label: "HTML tag injection" },
];

const BASE64_PATTERNS: RegExp[] = [
  /[A-Za-z0-9+/]{40,}={0,2}/,
  /data:[^;]*;base64,[A-Za-z0-9+/]+=*/i,
  /base64\s*[`'"]*[A-Za-z0-9+/]{20,}[`'"]*/i,
];

const CODE_EXECUTION_PATTERNS: RegExp[] = [
  /\beval\s*\(/i,
  /\bFunction\s*\(/i,
  /\bexec\s*\(/i,
  /\bexecSync\b/i,
  /\bspawn\s*\(/i,
  /\bchild_process\b/i,
  /\brequire\s*\(/i,
  /\bimport\s*\(/i,
  /\bprocess\.\w+/i,
  /\bconstructor\s*\(/i,
  /\b__proto__\b/i,
  /\bprototype\b/i,
];

export type GuardResult =
  | { allowed: true; sanitized: string }
  | { allowed: false; reason: string };

export function guardChatInput(raw: string): GuardResult {
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return { allowed: false, reason: "Message cannot be empty." };
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { allowed: false, reason: `Message too long (max ${MAX_MESSAGE_LENGTH} characters).` };
  }

  // Check prompt injection patterns
  for (const { pattern, label } of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { allowed: false, reason: `Message blocked: potential ${label} detected.` };
    }
  }

  // Check base64 patterns
  for (const pattern of BASE64_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { allowed: false, reason: "Message blocked: base64-encoded content is not allowed." };
    }
  }

  // Check code execution patterns
  for (const pattern of CODE_EXECUTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { allowed: false, reason: "Message blocked: code execution patterns are not allowed." };
    }
  }

  return { allowed: true, sanitized: trimmed };
}

export function getConversationSizeLimit(): number {
  return MAX_CONVERSATION_MESSAGES;
}
