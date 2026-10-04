import { Request, Response, NextFunction } from "express"
import * as aiAnalysisService from "../services/ai-analysis.service"
import { AppError } from "../middleware/error.middleware"

/**
 * Controller to trigger and retrieve AI analysis for a support ticket.
 * POST /api/tickets/:ticketId/ai-analysis
 *
 * Restricted to AGENT role.
 * Does not accept ticket title/description/AI values from request body.
 * Always analyzes the real ticket content stored in PostgreSQL.
 * Returns HTTP 200 with the saved/updated AIAnalysis record.
 */
export async function generateTicketAnalysis(
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

    const analysis = await aiAnalysisService.analyzeTicket(ticketId)

    res.status(200).json(analysis)
  } catch (error) {
    next(error)
  }
}

/**
 * Controller to retrieve saved AI analysis for a support ticket.
 * GET /api/tickets/:ticketId/ai-analysis
 *
 * Restricted to AGENT role.
 * Returns HTTP 200 with saved AIAnalysis record.
 * Returns HTTP 404 if ticket or analysis does not exist.
 */
export async function getTicketAiAnalysis(
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

    const analysis = await aiAnalysisService.getTicketAiAnalysis(ticketId)

    res.status(200).json(analysis)
  } catch (error) {
    next(error)
  }
}
