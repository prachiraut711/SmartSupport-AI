import { Request, Response, NextFunction } from "express"
import * as agentDashboardService from "../services/agent-dashboard.service"
import { AppError } from "../middleware/error.middleware"

/**
 * Controller for Agent Dashboard retrieval.
 * GET /api/agent/dashboard
 *
 * Restricted to AGENT role.
 * Calculates platform-wide ticket metrics and retrieves recent support tickets.
 * Client query parameters and request body are strictly ignored.
 */
export async function getAgentDashboard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user

    if (!user || !user.userId || !user.role) {
      throw new AppError("Authentication required", 401)
    }

    const dashboard = await agentDashboardService.getAgentDashboard()

    res.status(200).json(dashboard)
  } catch (error) {
    next(error)
  }
}
