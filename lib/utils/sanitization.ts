const HTML_ENTITIES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
} as const satisfies Record<string, string>;
const HTML_ESCAPE_REGEX = /[&<>"'/]/g;

export function sanitizeText(input: string): string {
  if (!input) return "";
  // SAFETY: char is matched by HTML_ESCAPE_REGEX, which only matches keys of HTML_ENTITIES.
  return input.replace(
    HTML_ESCAPE_REGEX,
    (char) => HTML_ENTITIES[char as keyof typeof HTML_ENTITIES],
  );
}

export function sanitizeUrl(input: string): string {
  if (!input) return "";

  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  const dangerousProtocols = ["javascript:", "data:", "vbscript:", "file:", "about:"];

  for (const protocol of dangerousProtocols) {
    if (lower.startsWith(protocol)) {
      return "";
    }
  }

  const safeProtocols = ["http://", "https://", "mailto:"];
  const hasProtocol = safeProtocols.some((protocol) => lower.startsWith(protocol));

  if (!hasProtocol) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

export function sanitizeEmail(input: string): string {
  if (!input) return "";

  const trimmed = input.trim().toLowerCase();

  const emailRegex = /^[^\s@]+@[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return "";
  }

  return trimmed.replace(/[<>'"]/g, "");
}

export function sanitizePhone(input: string): string {
  if (!input) return "";

  return input.replace(/[^0-9\s\-()+ ]/g, "").trim();
}

const XSS_PATTERN =
  /<script|<iframe|<embed|<object|<applet|<base|<form|<link\s|<meta|javascript:|vbscript:|data:text\/html|\bon\w+\s*=/i;

export function noXssPattern(value: string): boolean {
  return !containsXssPattern(value);
}

export function containsXssPattern(input: string): boolean {
  if (!input) return false;
  if (!input.includes("<") && !input.includes(":") && !input.includes("=")) {
    return false;
  }
  return XSS_PATTERN.test(input);
}
