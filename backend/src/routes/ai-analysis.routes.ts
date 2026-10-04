import { Router } from "express"
import { authenticateToken } from "../middleware/auth.middleware"
import { requireRole } from "../middleware/role.middleware"
import {
  generateTicketAnalysis,
  getTicketAiAnalysis,
} from "../controllers/ai-analysis.controller"

const router = Router()

/**
 * Retrieve saved AI analysis for a support ticket.
 * GET /api/tickets/:ticketId/ai-analysis
 * Access: AGENT only
 */
router.get(
  "/:ticketId/ai-analysis",
  authenticateToken,
  requireRole(["AGENT"]),
  getTicketAiAnalysis
)

/**
 * Trigger AI analysis for a support ticket.
 * POST /api/tickets/:ticketId/ai-analysis
 * Access: AGENT only
 */
router.post(
  "/:ticketId/ai-analysis",
  authenticateToken,
  requireRole(["AGENT"]),
  generateTicketAnalysis
)

export default router
