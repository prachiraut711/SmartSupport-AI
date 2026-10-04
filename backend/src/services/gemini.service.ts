import { GoogleGenerativeAI, SchemaType, ResponseSchema } from "@google/generative-ai"
import { AppError } from "../middleware/error.middleware"
import {
  AIAnalysisResult,
  ALLOWED_CATEGORIES,
  ALLOWED_PRIORITIES,
  ALLOWED_SENTIMENTS,
  TicketCategory,
  TicketPriority,
  Sentiment,
} from "../types/ai.types"

/**
 * System prompt instructing Gemini to analyze the ticket and return strictly structured JSON.
 */
export const GEMINI_SYSTEM_INSTRUCTION = `You are an AI assistant for a customer support ticket management system.

Analyze the provided support ticket.

Return:
1. category
2. priority
3. sentiment
4. short summary
5. professional suggested reply

Allowed categories:
BILLING
TECHNICAL
ACCOUNT
SUBSCRIPTION
REFUND
OTHER

Allowed priorities:
LOW
MEDIUM
HIGH
URGENT

Allowed sentiments:
POSITIVE
NEUTRAL
NEGATIVE

Return ONLY valid JSON.
Do not include Markdown.
Do not include \`\`\`json.
Do not add explanations outside the JSON.`

/**
 * Gemini response schema enforcing strict JSON object shape.
 */
export const AI_RESPONSE_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    category: {
      type: SchemaType.STRING,
      format: "enum",
      enum: ALLOWED_CATEGORIES as unknown as string[],
    },
    priority: {
      type: SchemaType.STRING,
      format: "enum",
      enum: ALLOWED_PRIORITIES as unknown as string[],
    },
    sentiment: {
      type: SchemaType.STRING,
      format: "enum",
      enum: ALLOWED_SENTIMENTS as unknown as string[],
    },
    summary: {
      type: SchemaType.STRING,
    },
    suggestedReply: {
      type: SchemaType.STRING,
    },
  },
  required: ["category", "priority", "sentiment", "summary", "suggestedReply"],
}

/**
 * Safely strips Markdown code fences (e.g. ```json ... ```) if returned by the model.
 */
export function stripCodeFences(text: string): string {
  let cleaned = text.trim()
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "")
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.replace(/\s*```$/i, "")
  }
  return cleaned.trim()
}

/**
 * Extracts the outermost JSON object substring if surrounding whitespace or text exists.
 */
export function extractJsonString(raw: string): string {
  const stripped = stripCodeFences(raw)
  const firstBrace = stripped.indexOf("{")
  const lastBrace = stripped.lastIndexOf("}")
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
    return stripped.slice(firstBrace, lastBrace + 1)
  }
  return stripped
}

/**
 * Parses and validates raw model text against allowed enums and non-empty string constraints.
 * Throws controlled AppError (HTTP 502) if response is malformed or invalid.
 */
export function parseAndValidateAIResponse(rawText: string): AIAnalysisResult {
  if (typeof rawText !== "string" || rawText.trim().length === 0) {
    throw new AppError("AI returned an invalid analysis", 502)
  }

  let parsed: unknown
  try {
    const jsonString = extractJsonString(rawText)
    parsed = JSON.parse(jsonString)
  } catch {
    throw new AppError("AI returned an invalid analysis", 502)
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new AppError("AI returned an invalid analysis", 502)
  }

  const data = parsed as Record<string, unknown>

  // 1. Required fields presence check
  if (
    typeof data.category !== "string" ||
    typeof data.priority !== "string" ||
    typeof data.sentiment !== "string" ||
    typeof data.summary !== "string" ||
    typeof data.suggestedReply !== "string"
  ) {
    throw new AppError("AI returned an invalid analysis", 502)
  }

  // 2. Validate category against allowed business values
  const categoryUpper = data.category.trim().toUpperCase()
  if (!ALLOWED_CATEGORIES.includes(categoryUpper as TicketCategory)) {
    throw new AppError("AI returned an invalid analysis", 502)
  }

  // 3. Validate priority against allowed business values
  const priorityUpper = data.priority.trim().toUpperCase()
  if (!ALLOWED_PRIORITIES.includes(priorityUpper as TicketPriority)) {
    throw new AppError("AI returned an invalid analysis", 502)
  }

  // 4. Validate sentiment against allowed business values
  const sentimentUpper = data.sentiment.trim().toUpperCase()
  if (!ALLOWED_SENTIMENTS.includes(sentimentUpper as Sentiment)) {
    throw new AppError("AI returned an invalid analysis", 502)
  }

  // 5. Validate summary (must be non-empty string)
  const summary = data.summary.trim()
  if (summary.length === 0) {
    throw new AppError("AI returned an invalid analysis", 502)
  }

  // 6. Validate suggestedReply (must be non-empty string)
  const suggestedReply = data.suggestedReply.trim()
  if (suggestedReply.length === 0) {
    throw new AppError("AI returned an invalid analysis", 502)
  }

  return {
    category: categoryUpper as TicketCategory,
    priority: priorityUpper as TicketPriority,
    sentiment: sentimentUpper as Sentiment,
    summary,
    suggestedReply,
  }
}

export interface AnalyzeTicketOptions {
  client?: GoogleGenerativeAI
  model?: string
  maxRetries?: number
  retryDelayMs?: number
}

/**
 * Determines whether an error from the upstream Gemini API is transient
 * (e.g. 503 Service Unavailable, high load, rate limit, network timeout)
 * and eligible for retry.
 *
 * Permanent client errors (400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found),
 * input validation errors, and response parsing errors are NEVER retried.
 */
export function isTransientError(err: unknown): boolean {
  if (err instanceof AppError) return false
  if (!err) return false

  const errorObj = err as { status?: number; statusCode?: number; message?: string }
  const status = errorObj.status || errorObj.statusCode

  // 4xx client errors (except 429 Too Many Requests) are permanent and should never be retried
  if (status && status >= 400 && status < 500 && status !== 429) {
    return false
  }

  // Explicit 503 or 429 status code
  if (status === 503 || status === 429) {
    return true
  }

  const message = typeof errorObj.message === "string" ? errorObj.message.toLowerCase() : ""

  // If message clearly indicates a permanent client error, do not retry
  if (
    message.includes("400") ||
    message.includes("401") ||
    message.includes("403") ||
    message.includes("404") ||
    message.includes("invalid argument") ||
    message.includes("bad request") ||
    message.includes("not found")
  ) {
    return false
  }

  // Transient / availability indicators
  if (
    message.includes("503") ||
    message.includes("unavailable") ||
    message.includes("high load") ||
    message.includes("overloaded") ||
    message.includes("resource_exhausted") ||
    message.includes("exhaust") ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("429") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("timeout") ||
    message.includes("temporarily")
  ) {
    return true
  }

  // 5xx server errors default to transient
  if (status && status >= 500) {
    return true
  }

  return false
}

/**
 * Analyzes a ticket using Google Gemini API.
 * Sends only ticket title and description, receives structured JSON, validates it, and returns AIAnalysisResult.
 * Automatically retries up to 2 additional times with a delay on temporary 503 / availability errors.
 */
export async function analyzeTicket(
  title: string,
  description: string,
  options?: AnalyzeTicketOptions
): Promise<AIAnalysisResult> {
  // Validate input parameters
  if (typeof title !== "string" || title.trim().length === 0) {
    throw new AppError("Ticket title is required for AI analysis", 400)
  }
  if (typeof description !== "string" || description.trim().length === 0) {
    throw new AppError("Ticket description is required for AI analysis", 400)
  }

  // Check API key if no injected client is provided
  const apiKey = process.env.GEMINI_API_KEY
  if (!options?.client) {
    if (!apiKey || apiKey.trim() === "" || apiKey === "your_gemini_api_key_here") {
      throw new AppError("Gemini API key is not configured", 500)
    }
  }

  const genAI = options?.client ?? new GoogleGenerativeAI(apiKey!)
  const modelName = options?.model ?? process.env.GEMINI_MODEL ?? "gemini-3.8-flash"
  const maxRetries = options?.maxRetries ?? 2
  const retryDelayMs = options?.retryDelayMs ?? 1000

  // Only pass ticket content - no secrets, credentials, or unrelated user data
  const prompt = `Title:\n${title.trim()}\n\nDescription:\n${description.trim()}`

  let rawText = ""
  let lastError: unknown = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: AI_RESPONSE_SCHEMA,
          temperature: 0.2,
        },
      })

      const result = await model.generateContent(prompt)
      const response = await result.response
      rawText = response.text()
      lastError = null
      break
    } catch (err: unknown) {
      if (err instanceof AppError) {
        throw err
      }

      lastError = err

      // Check if transient error and we have retries remaining
      if (attempt < maxRetries && isTransientError(err)) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
        continue
      }

      // Not retryable or out of retry attempts
      break
    }
  }

  if (lastError) {
    // Controlled error without leaking keys or raw stack to client
    const rawErrorMessage = lastError instanceof Error ? lastError.message : "Unknown error"
    const sanitizedError = rawErrorMessage
      .replace(/AIza[0-9A-Za-z-_]{20,}/g, "[REDACTED]")
      .replace(new RegExp(apiKey || "___", "g"), "[REDACTED]")
    console.error("Gemini API request failed:", sanitizedError)
    throw new AppError("AI service temporarily unavailable", 503)
  }

  if (!rawText || rawText.trim().length === 0) {
    throw new AppError("AI returned an invalid analysis", 502)
  }

  return parseAndValidateAIResponse(rawText)
}

export const geminiService = {
  analyzeTicket,
  parseAndValidateAIResponse,
  stripCodeFences,
  extractJsonString,
  isTransientError,
}

export default geminiService
