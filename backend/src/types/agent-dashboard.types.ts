import { TicketStatus, TicketPriority, TicketCategory } from "@prisma/client"

export interface AgentDashboardStats {
  totalTickets: number
  openTickets: number
  inProgressTickets: number
  waitingForCustomerTickets: number
  resolvedTickets: number
  closedTickets: number
  assignedTickets: number
  unassignedTickets: number
}

export interface AgentDashboardTicket {
  id: string
  title: string
  status: TicketStatus
  priority: TicketPriority
  category: TicketCategory
  customerId: string
  agentId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface AgentDashboardResponse {
  stats: AgentDashboardStats
  recentTickets: AgentDashboardTicket[]
}
