import { apiRequest } from "./api"
import type { AgentDashboardResponse } from "@/types/agent-dashboard"

/**
 * Fetches global support queue statistics and recent tickets for authenticated agents.
 * Endpoint: GET /api/agent/dashboard
 */
export async function getAgentDashboard(): Promise<AgentDashboardResponse> {
  return apiRequest<AgentDashboardResponse>("/agent/dashboard", {
    method: "GET",
  })
}

export const agentDashboardService = {
  getAgentDashboard,
}

export default agentDashboardService
