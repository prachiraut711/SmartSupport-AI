import { Router } from "express"
import {
  createTicket,
  getTickets,
  getTicketById,
  updateTicket,
  assignTicket,
} from "../controllers/ticket.controller"
import { authenticateToken } from "../middleware/auth.middleware"
import { requireRole } from "../middleware/role.middleware"

const router = Router()

// POST /api/tickets - Customer ticket creation (CUSTOMER only)
router.post("/", authenticateToken, requireRole("CUSTOMER"), createTicket)

// GET /api/tickets - Ticket listing (CUSTOMER sees own tickets, AGENT sees full queue)
router.get("/", authenticateToken, requireRole(["CUSTOMER", "AGENT"]), getTickets)

// GET /api/tickets/:ticketId - Ticket details (CUSTOMER sees own ticket, AGENT sees any ticket)
router.get("/:ticketId", authenticateToken, requireRole(["CUSTOMER", "AGENT"]), getTicketById)

// PATCH /api/tickets/:ticketId/assignment - Agent ticket assignment (AGENT only)
router.patch("/:ticketId/assignment", authenticateToken, requireRole("AGENT"), assignTicket)

// PATCH /api/tickets/:ticketId - Agent ticket update (AGENT only)
router.patch("/:ticketId", authenticateToken, requireRole("AGENT"), updateTicket)

export default router




