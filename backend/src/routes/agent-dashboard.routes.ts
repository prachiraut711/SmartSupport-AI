import { Router } from "express"
import { authenticateToken } from "../middleware/auth.middleware"
import { requireRole } from "../middleware/role.middleware"
import { getAgentDashboard } from "../controllers/agent-dashboard.controller"

const router = Router()

/**
 * Agent Dashboard metrics and recent ticket queue.
 * GET /api/agent/dashboard
 * Access: AGENT only
 */
router.get(
  "/",
  authenticateToken,
  requireRole(["AGENT"]),
  getAgentDashboard
)

export default router
