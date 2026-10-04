import { TicketStatus, TicketPriority, TicketCategory } from "@prisma/client"

export interface CustomerDashboardStats {
  totalTickets: number
  openTickets: number
  inProgressTickets: number
  waitingForCustomerTickets: number
  resolvedTickets: number
  closedTickets: number
}

export interface CustomerDashboardTicket {
  id: string
  title: string
  status: TicketStatus
  priority: TicketPriority
  category: TicketCategory
  createdAt: Date
  updatedAt: Date
}

export interface CustomerDashboardResponse {
  stats: CustomerDashboardStats
  recentTickets: CustomerDashboardTicket[]
}
