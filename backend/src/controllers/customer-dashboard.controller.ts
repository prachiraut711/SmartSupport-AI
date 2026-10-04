import { Request, Response, NextFunction } from "express"
import * as customerDashboardService from "../services/customer-dashboard.service"
import { AppError } from "../middleware/error.middleware"

/**
 * Controller for Customer Dashboard retrieval.
 * GET /api/customer/dashboard
 *
 * Restricted to CUSTOMER role.
 * Strictly derives customer ID from authenticated JWT (req.user.userId).
 * Any client query params or request body are ignored.
 */
export async function getCustomerDashboard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user

    if (!user || !user.userId || !user.role) {
      throw new AppError("Authentication required", 401)
    }

    const dashboard = await customerDashboardService.getCustomerDashboard(user.userId)

    res.status(200).json(dashboard)
  } catch (error) {
    next(error)
  }
}
