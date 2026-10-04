export type TicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_FOR_CUSTOMER"
  | "RESOLVED"
  | "CLOSED"

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT"

export type TicketCategory =
  | "BILLING"
  | "TECHNICAL"
  | "ACCOUNT"
  | "SUBSCRIPTION"
  | "REFUND"
  | "OTHER"

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
  createdAt: string
  updatedAt: string
}

export interface CustomerDashboardResponse {
  stats: CustomerDashboardStats
  recentTickets: CustomerDashboardTicket[]
}
