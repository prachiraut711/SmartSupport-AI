import { TicketStatus, TicketPriority, TicketCategory } from "@prisma/client"

export interface CreateTicketInput {
  title?: unknown
  description?: unknown
  customerId: string
}

export interface TicketResponse {
  id: string
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  category: TicketCategory
  customerId: string
  agentId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface TicketListResponse {
  tickets: TicketResponse[]
}

export interface UpdateTicketInput {
  status?: unknown
  priority?: unknown
  category?: unknown
}

export interface AssignTicketInput {
  agentId?: unknown
}

