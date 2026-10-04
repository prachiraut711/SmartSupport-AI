import { TicketCategory, TicketPriority, Sentiment } from "@prisma/client"

export type { TicketCategory, TicketPriority, Sentiment }
export type TicketSentiment = Sentiment

export interface AIAnalysisResult {
  category: TicketCategory
  priority: TicketPriority
  sentiment: Sentiment
  summary: string
  suggestedReply: string
}

export interface AIAnalysisResponse {
  id: string
  ticketId: string
  category: TicketCategory
  priority: TicketPriority
  sentiment: Sentiment
  summary: string
  suggestedReply: string
  createdAt: Date
  updatedAt: Date
}

export interface AnalyzeTicketInput {
  title: string
  description: string
}

export const ALLOWED_CATEGORIES: readonly TicketCategory[] = [
  "BILLING",
  "TECHNICAL",
  "ACCOUNT",
  "SUBSCRIPTION",
  "REFUND",
  "OTHER",
] as const

export const ALLOWED_PRIORITIES: readonly TicketPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
] as const

export const ALLOWED_SENTIMENTS: readonly Sentiment[] = [
  "POSITIVE",
  "NEUTRAL",
  "NEGATIVE",
] as const
