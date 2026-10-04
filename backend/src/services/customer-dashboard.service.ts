import prisma from "../utils/prisma"
import { AppError } from "../middleware/error.middleware"
import { CustomerDashboardResponse } from "../types/dashboard.types"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Retrieves the dashboard summary and recent tickets for the authenticated customer.
 *
 * 1. Strictly filters all counts and tickets by authenticated customerId.
 * 2. Runs status count aggregations and recent ticket query in parallel using Promise.all.
 * 3. Limits recent tickets to maximum 5, ordered newest first (createdAt DESC).
 * 4. Returns HTTP 200 with zero stats and empty array if the customer has no tickets.
 */
export async function getCustomerDashboard(
  customerId: string
): Promise<CustomerDashboardResponse> {
  if (!customerId || typeof customerId !== "string" || !UUID_REGEX.test(customerId.trim())) {
    throw new AppError("Invalid customer ID", 400)
  }

  const normalizedCustomerId = customerId.trim()

  const [
    totalTickets,
    openTickets,
    inProgressTickets,
    waitingForCustomerTickets,
    resolvedTickets,
    closedTickets,
    recentTickets,
  ] = await Promise.all([
    prisma.ticket.count({
      where: { customerId: normalizedCustomerId },
    }),
    prisma.ticket.count({
      where: { customerId: normalizedCustomerId, status: "OPEN" },
    }),
    prisma.ticket.count({
      where: { customerId: normalizedCustomerId, status: "IN_PROGRESS" },
    }),
    prisma.ticket.count({
      where: { customerId: normalizedCustomerId, status: "WAITING_FOR_CUSTOMER" },
    }),
    prisma.ticket.count({
      where: { customerId: normalizedCustomerId, status: "RESOLVED" },
    }),
    prisma.ticket.count({
      where: { customerId: normalizedCustomerId, status: "CLOSED" },
    }),
    prisma.ticket.findMany({
      where: { customerId: normalizedCustomerId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        category: true,
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
    },
    recentTickets,
  }
}

export const customerDashboardService = {
  getCustomerDashboard,
}

export default customerDashboardService
