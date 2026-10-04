import { apiRequest } from "./api"
import type { CustomerDashboardResponse } from "@/types/dashboard"

/**
 * Fetches real customer support dashboard statistics and recent tickets.
 * Endpoint: GET /api/customer/dashboard
 */
export async function getCustomerDashboard(): Promise<CustomerDashboardResponse> {
  return apiRequest<CustomerDashboardResponse>("/customer/dashboard", {
    method: "GET",
  })
}

export const dashboardService = {
  getCustomerDashboard,
}

export default dashboardService
