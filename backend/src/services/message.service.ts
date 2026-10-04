import { Role } from "@prisma/client"
import prisma from "../utils/prisma"
import { AppError } from "../middleware/error.middleware"
import { CreateMessageInput, MessageResponse } from "../types/message.types"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Service to create a public reply/message on a ticket.
 *
 * 1. Validates ticketId UUID format (HTTP 400 "Invalid ticket ID").
 * 2. Validates and trims message content:
 *    - Missing, non-string, or whitespace-only -> HTTP 400 "Message content is required".
 *    - Length > 5000 characters -> HTTP 400 "Message content must be 5000 characters or less".
 * 3. Enforces authorization:
 *    - CUSTOMER: must own the ticket (HTTP 404 "Ticket not found" if other or nonexistent).
 *    - AGENT: ticket must exist (HTTP 404 "Ticket not found" if nonexistent).
 * 4. Forces isInternal = false (public replies only).
 * 5. Returns safe message fields.
 */
export async function createMessage(
  ticketId: string,
  senderId: string,
  role: Role | string,
  input: CreateMessageInput
): Promise<MessageResponse> {
  // 1. Validate ticketId format
  if (!ticketId || typeof ticketId !== "string" || !UUID_REGEX.test(ticketId.trim())) {
    throw new AppError("Invalid ticket ID", 400)
  }

  const normalizedTicketId = ticketId.trim()

  // 2. Validate content
  const { content } = input

  if (!content || typeof content !== "string" || !content.trim()) {
    throw new AppError("Message content is required", 400)
  }

  const trimmedContent = content.trim()

  if (trimmedContent.length > 5000) {
    throw new AppError("Message content must be 5000 characters or less", 400)
  }

  // 3. Verify ticket access based on role
  if (role === Role.CUSTOMER) {
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: normalizedTicketId,
        customerId: senderId,
      },
      select: { id: true },
    })

    if (!ticket) {
      throw new AppError("Ticket not found", 404)
    }
  } else if (role === Role.AGENT) {
    const ticket = await prisma.ticket.findUnique({
      where: {
        id: normalizedTicketId,
      },
      select: { id: true },
    })

    if (!ticket) {
      throw new AppError("Ticket not found", 404)
    }
  } else {
    throw new AppError("Forbidden: insufficient permissions", 403)
  }

  // 4. Create public reply (isInternal strictly false)
  const message = await prisma.message.create({
    data: {
      content: trimmedContent,
      ticketId: normalizedTicketId,
      senderId,
      isInternal: false,
    },
    select: {
      id: true,
      content: true,
      ticketId: true,
      senderId: true,
      isInternal: true,
      createdAt: true,
    },
  })

  return message
}

/**
 * Service to retrieve message history for a ticket.
 *
 * 1. Validates ticketId UUID format (HTTP 400 "Invalid ticket ID").
 * 2. Enforces authorization:
 *    - CUSTOMER: must own the ticket (HTTP 404 "Ticket not found" if other or nonexistent).
 *    - AGENT: ticket must exist (HTTP 404 "Ticket not found" if nonexistent).
 * 3. Queries messages belonging to ticket ordered by createdAt ASC (chronological).
 * 4. Returns safe message fields.
 */
export async function getTicketMessages(
  ticketId: string,
  userId: string,
  role: Role | string
): Promise<MessageResponse[]> {
  // 1. Validate ticketId format
  if (!ticketId || typeof ticketId !== "string" || !UUID_REGEX.test(ticketId.trim())) {
    throw new AppError("Invalid ticket ID", 400)
  }

  const normalizedTicketId = ticketId.trim()

  // 2. Verify ticket access based on role
  if (role === Role.CUSTOMER) {
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: normalizedTicketId,
        customerId: userId,
      },
      select: { id: true },
    })

    if (!ticket) {
      throw new AppError("Ticket not found", 404)
    }
  } else if (role === Role.AGENT) {
    const ticket = await prisma.ticket.findUnique({
      where: {
        id: normalizedTicketId,
      },
      select: { id: true },
    })

    if (!ticket) {
      throw new AppError("Ticket not found", 404)
    }
  } else {
    throw new AppError("Forbidden: insufficient permissions", 403)
  }

  // 3. Query messages in chronological order (createdAt ASC)
  const messages = await prisma.message.findMany({
    where: {
      ticketId: normalizedTicketId,
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      content: true,
      ticketId: true,
      senderId: true,
      isInternal: true,
      createdAt: true,
    },
  })

  return messages
}

