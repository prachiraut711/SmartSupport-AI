import { Router } from "express"
import { createMessage, getMessages } from "../controllers/message.controller"
import { authenticateToken } from "../middleware/auth.middleware"
import { requireRole } from "../middleware/role.middleware"

const router = Router({ mergeParams: true })

// POST /api/tickets/:ticketId/messages - Create public reply on a ticket
router.post(
  "/:ticketId/messages",
  authenticateToken,
  requireRole(["CUSTOMER", "AGENT"]),
  createMessage
)

// GET /api/tickets/:ticketId/messages - Retrieve message history
router.get(
  "/:ticketId/messages",
  authenticateToken,
  requireRole(["CUSTOMER", "AGENT"]),
  getMessages
)

export default router

