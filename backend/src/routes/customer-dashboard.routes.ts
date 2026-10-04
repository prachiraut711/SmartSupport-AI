import { Router } from "express"
import { authenticateToken } from "../middleware/auth.middleware"
import { requireRole } from "../middleware/role.middleware"
import { getCustomerDashboard } from "../controllers/customer-dashboard.controller"

const router = Router()

/**
 * Customer Dashboard summary and recent tickets.
 * GET /api/customer/dashboard
 * Access: CUSTOMER only
 */
router.get(
  "/",
  authenticateToken,
  requireRole(["CUSTOMER"]),
  getCustomerDashboard
)

export default router
