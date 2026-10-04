import prisma from "../utils/prisma"
import { AppError } from "../middleware/error.middleware"
import { geminiService } from "./gemini.service"
import { AIAnalysisResponse, AIAnalysisResult } from "../types/ai.types"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Service to generate and persist AI analysis for a support ticket.
 *
 * 1. Validates ticket UUID format.
 * 2. Fetches ticket title and description from PostgreSQL.
 * 3. Sends only title and description to Gemini service.
 * 4. Receives validated AIAnalysisResult.
 * 5. Upserts record in the AIAnalysis table (creating on first analysis, updating on re-analysis).
 * 6. Returns safe AI analysis object.
 *
 * NOTE: The ticket itself (status, priority, category, assignee) is NEVER modified.
 */
export async function analyzeTicket(
  ticketId: string,
  geminiRunner?: (title: string, description: string) => Promise<AIAnalysisResult>
): Promise<AIAnalysisResponse> {
  // 1. Validate ticket UUID format
  if (!ticketId || typeof ticketId !== "string" || !UUID_REGEX.test(ticketId.trim())) {
    throw new AppError("Invalid ticket ID", 400)
  }

  const normalizedTicketId = ticketId.trim()

  // 2. Retrieve ticket by ID - read only title and description
  const ticket = await prisma.ticket.findUnique({
    where: { id: normalizedTicketId },
    select: {
      id: true,
      title: true,
      description: true,
    },
  })

  if (!ticket) {
    throw new AppError("Ticket not found", 404)
  }

  // 3. Call Gemini service (or injected runner for testing)
  const runner = geminiRunner ?? geminiService.analyzeTicket
  const aiResult: AIAnalysisResult = await runner(ticket.title, ticket.description)

  // 4. Upsert AIAnalysis record in PostgreSQL (guarantees exactly one record per ticket)
  const saved = await prisma.aIAnalysis.upsert({
    where: { ticketId: ticket.id },
    create: {
      ticketId: ticket.id,
      category: aiResult.category,
      priority: aiResult.priority,
      sentiment: aiResult.sentiment,
      summary: aiResult.summary,
      suggestedReply: aiResult.suggestedReply,
    },
    update: {
      category: aiResult.category,
      priority: aiResult.priority,
      sentiment: aiResult.sentiment,
      summary: aiResult.summary,
      suggestedReply: aiResult.suggestedReply,
    },
    select: {
      id: true,
      ticketId: true,
      category: true,
      priority: true,
      sentiment: true,
      summary: true,
      suggestedReply: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return saved
}

export const generateTicketAnalysis = analyzeTicket

/**
 * Service to retrieve existing AI analysis for a support ticket.
 *
 * 1. Validates ticket UUID format.
 * 2. Checks if ticket exists in PostgreSQL (throws 404 "Ticket not found" if missing).
 * 3. Retrieves AIAnalysis record from PostgreSQL (throws 404 "AI analysis not found" if not analyzed yet).
 * 4. Returns safe AI analysis object.
 */
export async function getTicketAiAnalysis(ticketId: string): Promise<AIAnalysisResponse> {
  // 1. Validate ticket UUID format
  if (!ticketId || typeof ticketId !== "string" || !UUID_REGEX.test(ticketId.trim())) {
    throw new AppError("Invalid ticket ID", 400)
  }

  const normalizedTicketId = ticketId.trim()

  // 2. Verify ticket exists
  const ticket = await prisma.ticket.findUnique({
    where: { id: normalizedTicketId },
    select: { id: true },
  })

  if (!ticket) {
    throw new AppError("Ticket not found", 404)
  }

  // 3. Retrieve saved AI analysis
  const analysis = await prisma.aIAnalysis.findUnique({
    where: { ticketId: normalizedTicketId },
    select: {
      id: true,
      ticketId: true,
      category: true,
      priority: true,
      sentiment: true,
      summary: true,
      suggestedReply: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!analysis) {
    throw new AppError("AI analysis not found", 404)
  }

  return analysis
}

export const aiAnalysisService = {
  analyzeTicket,
  generateTicketAnalysis,
  getTicketAiAnalysis,
}

export default aiAnalysisService
