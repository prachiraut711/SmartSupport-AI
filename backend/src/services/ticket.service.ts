import { TicketStatus, TicketPriority, TicketCategory, Role } from "@prisma/client"
import prisma from "../utils/prisma"
import { AppError } from "../middleware/error.middleware"
import {
  CreateTicketInput,
  TicketResponse,
  UpdateTicketInput,
  AssignTicketInput,
} from "../types/ticket.types"


const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const VALID_STATUSES = new Set<string>(Object.values(TicketStatus))
const VALID_PRIORITIES = new Set<string>(Object.values(TicketPriority))
const VALID_CATEGORIES = new Set<string>(Object.values(TicketCategory))

/**
 * Service to handle customer ticket creation.
 *
 * 1. Validates title and description are present and non-empty.
 * 2. Normalizes title and description (trim whitespace).
 * 3. Enforces backend-controlled defaults:
 *    - status: OPEN
 *    - priority: LOW
 *    - category: OTHER
 *    - agentId: null
 *    - customerId: authenticated user ID
 * 4. Persists the ticket to PostgreSQL via Prisma.
 * 5. Returns a safe ticket object.
 */
export async function createTicket(input: CreateTicketInput): Promise<TicketResponse> {
  const { title, description, customerId } = input

  // Validate authenticated customer ID
  if (!customerId || typeof customerId !== "string" || !customerId.trim()) {
    throw new AppError("Authentication required", 401)
  }

  // Validate title
  if (!title || typeof title !== "string" || !title.trim()) {
    throw new AppError("Title is required and cannot be empty", 400)
  }

  // Validate description
  if (!description || typeof description !== "string" || !description.trim()) {
    throw new AppError("Description is required and cannot be empty", 400)
  }

  const normalizedTitle = title.trim()
  const normalizedDescription = description.trim()

  if (normalizedTitle.length > 255) {
    throw new AppError("Title must be 255 characters or fewer", 400)
  }

  if (normalizedDescription.length > 10000) {
    throw new AppError("Description must be 10,000 characters or fewer", 400)
  }

  // Create ticket in database with strict backend defaults
  const ticket = await prisma.ticket.create({
    data: {
      title: normalizedTitle,
      description: normalizedDescription,
      status: TicketStatus.OPEN,
      priority: TicketPriority.LOW,
      category: TicketCategory.OTHER,
      agentId: null,
      customerId,
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      category: true,
      customerId: true,
      agentId: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return ticket
}

/**
 * Service to retrieve all tickets belonging to the authenticated customer.
 *
 * 1. Validates authenticated customerId.
 * 2. Queries PostgreSQL via Prisma strictly filtering by customerId.
 * 3. Orders results newest first (createdAt DESC).
 * 4. Returns safe ticket fields.
 */
export async function getCustomerTickets(customerId: string): Promise<TicketResponse[]> {
  if (!customerId || typeof customerId !== "string" || !customerId.trim()) {
    throw new AppError("Authentication required", 401)
  }

  const tickets = await prisma.ticket.findMany({
    where: {
      customerId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      category: true,
      customerId: true,
      agentId: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return tickets
}

/**
 * Service to retrieve a single ticket belonging to the authenticated customer.
 *
 * 1. Validates authenticated customerId.
 * 2. Validates ticketId is a valid UUID format (rejects malformed IDs with HTTP 400).
 * 3. Enforces database-level ownership directly in the Prisma query:
 *    { where: { id: ticketId, customerId } }.
 * 4. Returns generic HTTP 404 "Ticket not found" if ticket does not exist or belongs to another customer.
 * 5. Returns safe ticket fields.
 */
export async function getCustomerTicketById(
  ticketId: string,
  customerId: string
): Promise<TicketResponse> {
  // Validate authenticated customer ID
  if (!customerId || typeof customerId !== "string" || !customerId.trim()) {
    throw new AppError("Authentication required", 401)
  }

  // Validate ticketId format
  if (!ticketId || typeof ticketId !== "string" || !UUID_REGEX.test(ticketId.trim())) {
    throw new AppError("Invalid ticket ID", 400)
  }

  const normalizedTicketId = ticketId.trim()

  // Enforce ownership directly in query: must match both ticketId and customerId
  const ticket = await prisma.ticket.findFirst({
    where: {
      id: normalizedTicketId,
      customerId,
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      category: true,
      customerId: true,
      agentId: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  // Return generic 404 if ticket doesn't exist or belongs to another customer
  if (!ticket) {
    throw new AppError("Ticket not found", 404)
  }

  return ticket
}

/**
 * Service to retrieve all tickets across all customers for support agents.
 *
 * 1. Queries PostgreSQL via Prisma without customer filtering.
 * 2. Orders results newest first (createdAt DESC).
 * 3. Returns safe ticket fields.
 */
export async function getAgentTickets(): Promise<TicketResponse[]> {
  const tickets = await prisma.ticket.findMany({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      category: true,
      customerId: true,
      agentId: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return tickets
}

/**
 * Service to retrieve a single ticket by ID for support agents.
 *
 * 1. Validates ticketId is a valid UUID format (rejects malformed IDs with HTTP 400).
 * 2. Queries PostgreSQL via Prisma by ID without customer ownership filtering.
 * 3. Returns HTTP 404 "Ticket not found" if ticket does not exist.
 * 4. Returns safe ticket fields.
 */
export async function getAgentTicketById(ticketId: string): Promise<TicketResponse> {
  // Validate ticketId format
  if (!ticketId || typeof ticketId !== "string" || !UUID_REGEX.test(ticketId.trim())) {
    throw new AppError("Invalid ticket ID", 400)
  }

  const normalizedTicketId = ticketId.trim()

  const ticket = await prisma.ticket.findUnique({
    where: {
      id: normalizedTicketId,
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      category: true,
      customerId: true,
      agentId: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!ticket) {
    throw new AppError("Ticket not found", 404)
  }

  return ticket
}

/**
 * Service to update an existing ticket (AGENT only).
 *
 * 1. Validates ticketId is a valid UUID format (rejects malformed IDs with HTTP 400).
 * 2. Validates at least one valid update field (status, priority, category) is provided.
 * 3. Validates status enum if provided (rejects invalid with HTTP 400 "Invalid status").
 * 4. Validates priority enum if provided (rejects invalid with HTTP 400 "Invalid priority").
 * 5. Validates category enum if provided (rejects invalid with HTTP 400 "Invalid category").
 * 6. Checks if the ticket exists (returns HTTP 404 "Ticket not found" if nonexistent).
 * 7. Applies updates strictly to allowed fields using an explicit allowlist.
 * 8. Returns safe ticket fields.
 */
export async function updateTicket(
  ticketId: string,
  input: UpdateTicketInput
): Promise<TicketResponse> {
  // Validate ticketId format
  if (!ticketId || typeof ticketId !== "string" || !UUID_REGEX.test(ticketId.trim())) {
    throw new AppError("Invalid ticket ID", 400)
  }

  const normalizedTicketId = ticketId.trim()
  const { status, priority, category } = input

  // Empty update protection
  if (status === undefined && priority === undefined && category === undefined) {
    throw new AppError("At least one field must be provided", 400)
  }

  // Validate status if provided
  if (status !== undefined) {
    if (typeof status !== "string" || !VALID_STATUSES.has(status)) {
      throw new AppError("Invalid status", 400)
    }
  }

  // Validate priority if provided
  if (priority !== undefined) {
    if (typeof priority !== "string" || !VALID_PRIORITIES.has(priority)) {
      throw new AppError("Invalid priority", 400)
    }
  }

  // Validate category if provided
  if (category !== undefined) {
    if (typeof category !== "string" || !VALID_CATEGORIES.has(category)) {
      throw new AppError("Invalid category", 400)
    }
  }

  // Confirm ticket exists
  const existingTicket = await prisma.ticket.findUnique({
    where: { id: normalizedTicketId },
    select: { id: true },
  })

  if (!existingTicket) {
    throw new AppError("Ticket not found", 404)
  }

  // Explicit allowlist update data object
  const data: {
    status?: TicketStatus
    priority?: TicketPriority
    category?: TicketCategory
  } = {}

  if (status !== undefined) data.status = status as TicketStatus
  if (priority !== undefined) data.priority = priority as TicketPriority
  if (category !== undefined) data.category = category as TicketCategory

  const updatedTicket = await prisma.ticket.update({
    where: { id: normalizedTicketId },
    data,
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      category: true,
      customerId: true,
      agentId: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return updatedTicket
}

/**
 * Service to assign or unassign a ticket (AGENT only).
 *
 * 1. Validates ticketId is a valid UUID format (HTTP 400 "Invalid ticket ID").
 * 2. Checks if agentId is provided in input (HTTP 400 "Agent ID is required").
 *    Note: agentId === null is valid unassignment; agentId === undefined is missing.
 * 3. When agentId is not null:
 *    - Validates agentId is a valid UUID format (HTTP 400 "Invalid agent ID").
 *    - Queries user by agentId (HTTP 404 "Agent not found" if missing).
 *    - Validates user role is AGENT (HTTP 400 "User is not an agent" if not).
 * 4. Confirms ticket exists (HTTP 404 "Ticket not found" if missing).
 * 5. Updates ticket strictly with { agentId: targetAgentId }.
 * 6. Returns safe ticket fields.
 */
export async function assignTicket(
  ticketId: string,
  input: AssignTicketInput
): Promise<TicketResponse> {
  // 1. Validate ticketId format
  if (!ticketId || typeof ticketId !== "string" || !UUID_REGEX.test(ticketId.trim())) {
    throw new AppError("Invalid ticket ID", 400)
  }

  const normalizedTicketId = ticketId.trim()
  const { agentId } = input

  // 2. Validate agentId presence (distinguish undefined from explicit null)
  if (agentId === undefined) {
    throw new AppError("Agent ID is required", 400)
  }

  let targetAgentId: string | null = null

  // 3. If agentId is not null, validate target agent
  if (agentId !== null) {
    if (typeof agentId !== "string" || !UUID_REGEX.test(agentId.trim())) {
      throw new AppError("Invalid agent ID", 400)
    }

    const normalizedAgentId = agentId.trim()

    const targetUser = await prisma.user.findUnique({
      where: { id: normalizedAgentId },
      select: { id: true, role: true },
    })

    if (!targetUser) {
      throw new AppError("Agent not found", 404)
    }

    if (targetUser.role !== Role.AGENT) {
      throw new AppError("User is not an agent", 400)
    }

    targetAgentId = normalizedAgentId
  }

  // 4. Confirm ticket exists
  const existingTicket = await prisma.ticket.findUnique({
    where: { id: normalizedTicketId },
    select: { id: true },
  })

  if (!existingTicket) {
    throw new AppError("Ticket not found", 404)
  }

  // 5. Update only agentId
  const updatedTicket = await prisma.ticket.update({
    where: { id: normalizedTicketId },
    data: {
      agentId: targetAgentId,
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      category: true,
      customerId: true,
      agentId: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return updatedTicket
}



