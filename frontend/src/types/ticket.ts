import type { TicketStatus, TicketPriority, TicketCategory } from "./dashboard"

export interface Ticket {
  id: string
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  category: TicketCategory
  customerId: string
  agentId: string | null
  createdAt: string
  updatedAt: string
}

export interface TicketMessage {
  id: string
  content: string
  ticketId: string
  senderId: string
  isInternal: boolean
  createdAt: string
}

export type Sentiment = "POSITIVE" | "NEUTRAL" | "NEGATIVE"

export interface AIAnalysis {
  id: string
  ticketId: string
  category: TicketCategory
  priority: TicketPriority
  sentiment: Sentiment
  summary: string
  suggestedReply: string
  createdAt: string
  updatedAt: string
}

export interface CreateTicketDTO {
  title: string
  description: string
}

export interface UpdateTicketDTO {
  status?: TicketStatus
  priority?: TicketPriority
  category?: TicketCategory
}
