import { Request, Response, NextFunction } from "express"
import * as messageService from "../services/message.service"
import { AppError } from "../middleware/error.middleware"

/**
 * Handles ticket reply/message creation.
 * POST /api/tickets/:ticketId/messages
 *
 * Both CUSTOMER (own tickets) and AGENT (any ticket) can reply.
 * Only `content` is extracted from request body.
 */
export async function createMessage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user

    if (!user || !user.userId || !user.role) {
      throw new AppError("Authentication required", 401)
    }

    const rawTicketId = req.params.ticketId
    const ticketId = Array.isArray(rawTicketId) ? rawTicketId[0] : rawTicketId

    // Explicit allowlist: only extract `content` from request body.
    // Client-supplied senderId, ticketId, isInternal, id, etc. are strictly ignored.
    const { content } = req.body || {}

    const message = await messageService.createMessage(
      ticketId,
      user.userId,
      user.role,
      { content }
    )

    res.status(201).json(message)
  } catch (error) {
    next(error)
  }
}

/**
 * Handles ticket message history retrieval.
 * GET /api/tickets/:ticketId/messages
 *
 * Both CUSTOMER (own tickets) and AGENT (any ticket) can view history.
 * No request body is accepted or required.
 */
export async function getMessages(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user

    if (!user || !user.userId || !user.role) {
      throw new AppError("Authentication required", 401)
    }

    const rawTicketId = req.params.ticketId
    const ticketId = Array.isArray(rawTicketId) ? rawTicketId[0] : rawTicketId

    const messages = await messageService.getTicketMessages(
      ticketId,
      user.userId,
      user.role
    )

    res.status(200).json({ messages })
  } catch (error) {
    next(error)
  }
}

