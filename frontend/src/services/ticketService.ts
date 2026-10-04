import { apiRequest, ApiError } from "./api"
import type {
  Ticket,
  TicketMessage,
  CreateTicketDTO,
  UpdateTicketDTO,
  AIAnalysis,
} from "@/types/ticket"

export async function createTicket(data: CreateTicketDTO): Promise<Ticket> {
  return apiRequest<Ticket>("/tickets", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function getTicketById(ticketId: string): Promise<Ticket> {
  return apiRequest<Ticket>(`/tickets/${encodeURIComponent(ticketId)}`, {
    method: "GET",
  })
}

export async function getTicketMessages(ticketId: string): Promise<TicketMessage[]> {
  const res = await apiRequest<{ messages: TicketMessage[] }>(
    `/tickets/${encodeURIComponent(ticketId)}/messages`,
    {
      method: "GET",
    }
  )
  return res?.messages ?? []
}

export async function createTicketMessage(
  ticketId: string,
  content: string
): Promise<TicketMessage> {
  return apiRequest<TicketMessage>(`/tickets/${encodeURIComponent(ticketId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  })
}

export async function updateTicket(
  ticketId: string,
  updates: UpdateTicketDTO
): Promise<Ticket> {
  return apiRequest<Ticket>(`/tickets/${encodeURIComponent(ticketId)}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  })
}

export async function assignTicket(
  ticketId: string,
  agentId: string | null
): Promise<Ticket> {
  return apiRequest<Ticket>(`/tickets/${encodeURIComponent(ticketId)}/assignment`, {
    method: "PATCH",
    body: JSON.stringify({ agentId }),
  })
}

export async function generateTicketAiAnalysis(ticketId: string): Promise<AIAnalysis> {
  return apiRequest<AIAnalysis>(`/tickets/${encodeURIComponent(ticketId)}/ai-analysis`, {
    method: "POST",
  })
}

export async function getTicketAiAnalysis(ticketId: string): Promise<AIAnalysis | null> {
  try {
    return await apiRequest<AIAnalysis>(`/tickets/${encodeURIComponent(ticketId)}/ai-analysis`, {
      method: "GET",
    })
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null
    }
    throw err
  }
}
