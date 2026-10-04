import { Request, Response, NextFunction } from "express"
import { Role } from "@prisma/client"
import * as ticketService from "../services/ticket.service"
import { AppError } from "../middleware/error.middleware"

/**
 * Handles customer ticket creation requests.
 * POST /api/tickets
 */
export async function createTicket(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customerId = req.user?.userId

    if (!customerId) {
      throw new AppError("Authentication required", 401)
    }

    // Extract only title and description from request body.
    // Client-supplied customerId, agentId, status, priority, or category are strictly ignored.
    const { title, description } = req.body

    const ticket = await ticketService.createTicket({
      title,
      description,
      customerId,
    })

    res.status(201).json(ticket)
  } catch (error) {
    next(error)
  }
}

/**
 * Handles ticket listing requests for both CUSTOMER and AGENT.
 * GET /api/tickets
 *
 * - AGENT: Returns all tickets across all customers (support queue).
 * - CUSTOMER: Returns only tickets belonging to the authenticated customer.
 */
export async function getTickets(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user

    if (!user || !user.userId) {
      throw new AppError("Authentication required", 401)
    }

    if (user.role === Role.AGENT) {
      const tickets = await ticketService.getAgentTickets()
      res.status(200).json({ tickets })
      return
    }

    if (user.role === Role.CUSTOMER) {
      const tickets = await ticketService.getCustomerTickets(user.userId)
      res.status(200).json({ tickets })
      return
    }

    throw new AppError("Forbidden: insufficient permissions", 403)
  } catch (error) {
    next(error)
  }
}

// Retain getCustomerTickets alias for backwards compatibility
export const getCustomerTickets = getTickets


/**
 * Handles ticket details requests for both CUSTOMER and AGENT.
 * GET /api/tickets/:ticketId
 *
 * - AGENT: Can view any existing ticket.
 * - CUSTOMER: Can view only their own ticket.
 * - Other roles: Rejects with HTTP 403 Forbidden.
 */
export async function getTicketById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user

    if (!user || !user.userId) {
      throw new AppError("Authentication required", 401)
    }

    const rawTicketId = req.params.ticketId
    const ticketId = Array.isArray(rawTicketId) ? rawTicketId[0] : rawTicketId

    if (user.role === Role.AGENT) {
      const ticket = await ticketService.getAgentTicketById(ticketId)
      res.status(200).json(ticket)
      return
    }

    if (user.role === Role.CUSTOMER) {
      const ticket = await ticketService.getCustomerTicketById(ticketId, user.userId)
      res.status(200).json(ticket)
      return
    }

    throw new AppError("Forbidden: insufficient permissions", 403)
  } catch (error) {
    next(error)
  }
}

// Retain getCustomerTicketById alias for backwards compatibility
export const getCustomerTicketById = getTicketById

/**
 * Handles agent ticket update requests.
 * PATCH /api/tickets/:ticketId
 *
 * Updates status, priority, and/or category.
 * Only allowed properties are extracted from the request body.
 */
export async function updateTicket(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user

    if (!user || !user.userId) {
      throw new AppError("Authentication required", 401)
    }

    const rawTicketId = req.params.ticketId
    const ticketId = Array.isArray(rawTicketId) ? rawTicketId[0] : rawTicketId

    // Explicit allowlist: extract only status, priority, category from request body.
    // Client-supplied customerId, agentId, title, description, id, etc. are strictly ignored.
    const { status, priority, category } = req.body || {}

    const updatedTicket = await ticketService.updateTicket(ticketId, {
      status,
      priority,
      category,
    })

    res.status(200).json(updatedTicket)
  } catch (error) {
    next(error)
  }
}

/**
 * Handles ticket assignment requests.
 * PATCH /api/tickets/:ticketId/assignment
 *
 * Assigns ticket to an agent or unassigns (agentId: null).
 * Only agentId is extracted from the request body.
 */
export async function assignTicket(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user

    if (!user || !user.userId) {
      throw new AppError("Authentication required", 401)
    }

    const rawTicketId = req.params.ticketId
    const ticketId = Array.isArray(rawTicketId) ? rawTicketId[0] : rawTicketId

    // Explicit allowlist: extract only agentId from request body.
    // Client-supplied customerId, status, priority, category, title, description, id, etc. are strictly ignored.
    const { agentId } = req.body || {}

    const updatedTicket = await ticketService.assignTicket(ticketId, {
      agentId,
    })

    res.status(200).json(updatedTicket)
  } catch (error) {
    next(error)
  }
}



