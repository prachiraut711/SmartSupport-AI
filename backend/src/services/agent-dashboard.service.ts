import prisma from "../utils/prisma"
import { AgentDashboardResponse } from "../types/agent-dashboard.types"

/**
 * Retrieves the dashboard summary and recent tickets for support agents.
 *
 * 1. Calculates global ticket statistics across all customers:
 *    - totalTickets, openTickets, inProgressTickets, waitingForCustomerTickets,
 *      resolvedTickets, closedTickets, assignedTickets, unassignedTickets.
 * 2. Fetches the 10 most recently created tickets across all customers.
 * 3. Returns clean, safe ticket objects without sensitive user relations or internal secrets.
 */
export async function getAgentDashboard(): Promise<AgentDashboardResponse> {
  const [
    totalTickets,
    openTickets,
    inProgressTickets,
    waitingForCustomerTickets,
    resolvedTickets,
    closedTickets,
    assignedTickets,
    unassignedTickets,
    recentTickets,
  ] = await Promise.all([
    prisma.ticket.count(),
    prisma.ticket.count({ where: { status: "OPEN" } }),
    prisma.ticket.count({ where: { status: "IN_PROGRESS" } }),
    prisma.ticket.count({ where: { status: "WAITING_FOR_CUSTOMER" } }),
    prisma.ticket.count({ where: { status: "RESOLVED" } }),
    prisma.ticket.count({ where: { status: "CLOSED" } }),
    prisma.ticket.count({ where: { agentId: { not: null } } }),
    prisma.ticket.count({ where: { agentId: null } }),
    prisma.ticket.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        category: true,
        customerId: true,
        agentId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ])

  return {
    stats: {
      totalTickets,
      openTickets,
      inProgressTickets,
      waitingForCustomerTickets,
      resolvedTickets,
      closedTickets,
      assignedTickets,
      unassignedTickets,
    },
    recentTickets,
  }
}

export const agentDashboardService = {
  getAgentDashboard,
}

export default agentDashboardService
