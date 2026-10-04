import { test, describe, before, after } from "node:test"
import assert from "node:assert/strict"
import { Server } from "node:http"
import { AddressInfo } from "node:net"
import app from "../src/server"
import prisma from "../src/utils/prisma"
import { hashPassword } from "../src/utils/password"
import { signToken } from "../src/utils/jwt"
import { TicketResponse } from "../src/types/ticket.types"

describe("Customer Ticket Creation (POST /api/tickets)", () => {
  let server: Server
  let baseUrl: string

  const customerEmail = "ticket.customer.test@example.com"
  const agentEmail = "ticket.agent.test@example.com"
  let customerId: string
  let agentId: string

  let customerToken: string
  let agentToken: string

  before(async () => {
    // Clean up any preexisting test users and their tickets
    await prisma.ticket.deleteMany({
      where: {
        customer: {
          email: { in: [customerEmail, agentEmail] },
        },
      },
    })
    await prisma.user.deleteMany({
      where: {
        email: { in: [customerEmail, agentEmail] },
      },
    })

    // Seed test CUSTOMER in PostgreSQL
    const hashedCustPass = await hashPassword("CustomerPass123!")
    const customer = await prisma.user.create({
      data: {
        name: "Ticket Customer",
        email: customerEmail,
        password: hashedCustPass,
        role: "CUSTOMER",
      },
    })
    customerId = customer.id
    customerToken = signToken({
      userId: customerId,
      role: "CUSTOMER",
    })

    // Seed test AGENT in PostgreSQL
    const hashedAgentPass = await hashPassword("AgentPass123!")
    const agent = await prisma.user.create({
      data: {
        name: "Ticket Agent",
        email: agentEmail,
        password: hashedAgentPass,
        role: "AGENT",
      },
    })
    agentId = agent.id
    agentToken = signToken({
      userId: agentId,
      role: "AGENT",
    })

    // Start ephemeral server
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo
        baseUrl = `http://localhost:${address.port}`
        resolve()
      })
    })
  })

  after(async () => {
    // Clean up all tickets created by test users
    await prisma.ticket.deleteMany({
      where: {
        customerId: { in: [customerId, agentId] },
      },
    })

    // Clean up test users
    await prisma.user.deleteMany({
      where: {
        id: { in: [customerId, agentId] },
      },
    })

    await prisma.$disconnect()

    // Close ephemeral server
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
  })

  test("1-6 & 15. Authenticated CUSTOMER creates ticket with default status, priority, category, null agent, and safe fields", async () => {
    const res = await fetch(`${baseUrl}/api/tickets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        title: "  Unable to access billing invoices  ",
        description: "  Getting a 404 error when clicking on invoice tab.  ",
      }),
    })

    assert.strictEqual(res.status, 201)
    const ticket = (await res.json()) as TicketResponse

    // 15. Verify response contains all expected safe ticket fields
    assert.ok(ticket.id, "Ticket ID must be present")
    assert.strictEqual(ticket.title, "Unable to access billing invoices", "Title should be trimmed")
    assert.strictEqual(
      ticket.description,
      "Getting a 404 error when clicking on invoice tab.",
      "Description should be trimmed"
    )

    // 2. Ownership belongs to authenticated customer
    assert.strictEqual(ticket.customerId, customerId)

    // 3. Default status is OPEN
    assert.strictEqual(ticket.status, "OPEN")

    // 4. Default priority is LOW
    assert.strictEqual(ticket.priority, "LOW")

    // 5. Default category is OTHER
    assert.strictEqual(ticket.category, "OTHER")

    // 6. New ticket has no assigned agent
    assert.strictEqual(ticket.agentId, null)

    assert.ok(ticket.createdAt, "createdAt timestamp must be present")
    assert.ok(ticket.updatedAt, "updatedAt timestamp must be present")

    // Direct database validation
    const dbTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    })
    assert.ok(dbTicket, "Ticket must exist in database")
    assert.strictEqual(dbTicket.customerId, customerId)
    assert.strictEqual(dbTicket.status, "OPEN")
    assert.strictEqual(dbTicket.priority, "LOW")
    assert.strictEqual(dbTicket.category, "OTHER")
    assert.strictEqual(dbTicket.agentId, null)
  })

  test("7. Unauthenticated request returns HTTP 401", async () => {
    const res = await fetch(`${baseUrl}/api/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Unauthenticated ticket",
        description: "Should fail with 401",
      }),
    })

    assert.strictEqual(res.status, 401)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Authentication required")
  })

  test("8. Invalid JWT returns HTTP 401", async () => {
    const res = await fetch(`${baseUrl}/api/tickets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer invalid.token.payload",
      },
      body: JSON.stringify({
        title: "Invalid JWT ticket",
        description: "Should fail with 401",
      }),
    })

    assert.strictEqual(res.status, 401)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Authentication required")
  })

  test("9. AGENT attempting to create a customer ticket returns HTTP 403", async () => {
    const res = await fetch(`${baseUrl}/api/tickets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${agentToken}`,
      },
      body: JSON.stringify({
        title: "Agent ticket attempt",
        description: "Agents should not be able to create customer tickets directly",
      }),
    })

    assert.strictEqual(res.status, 403)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Forbidden: insufficient permissions")
  })

  test("10. Missing title returns HTTP 400", async () => {
    const res = await fetch(`${baseUrl}/api/tickets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        description: "Missing title completely",
      }),
    })

    assert.strictEqual(res.status, 400)
    const data = (await res.json()) as { error: string }
    assert.match(data.error, /title/i)
  })

  test("11. Missing description returns HTTP 400", async () => {
    const res = await fetch(`${baseUrl}/api/tickets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        title: "Missing description completely",
      }),
    })

    assert.strictEqual(res.status, 400)
    const data = (await res.json()) as { error: string }
    assert.match(data.error, /description/i)
  })

  test("12. Whitespace-only title returns HTTP 400", async () => {
    const res = await fetch(`${baseUrl}/api/tickets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        title: "     ",
        description: "Valid description but title is whitespace",
      }),
    })

    assert.strictEqual(res.status, 400)
    const data = (await res.json()) as { error: string }
    assert.match(data.error, /title/i)
  })

  test("13. Whitespace-only description returns HTTP 400", async () => {
    const res = await fetch(`${baseUrl}/api/tickets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        title: "Valid title",
        description: "   \n\t   ",
      }),
    })

    assert.strictEqual(res.status, 400)
    const data = (await res.json()) as { error: string }
    assert.match(data.error, /description/i)
  })

  test("14. Client-supplied customerId cannot change ticket ownership", async () => {
    const maliciousSuppliedId = "fake-victim-uuid-999999"

    const res = await fetch(`${baseUrl}/api/tickets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        title: "Spoof Ownership Attempt",
        description: "Attempting to create a ticket on behalf of another user ID",
        customerId: maliciousSuppliedId,
        agentId: agentId,
        status: "RESOLVED",
        priority: "URGENT",
        category: "BILLING",
      }),
    })

    assert.strictEqual(res.status, 201)
    const ticket = (await res.json()) as TicketResponse

    // Server must enforce ownership from authenticated token, ignoring the malicious input
    assert.strictEqual(
      ticket.customerId,
      customerId,
      "Ticket customerId must be req.user.userId, not malicious client customerId"
    )
    assert.notStrictEqual(
      ticket.customerId,
      maliciousSuppliedId,
      "Malicious client customerId must be ignored"
    )

    // Backend defaults must NOT be overridden by client
    assert.strictEqual(ticket.status, "OPEN", "Status override must be ignored")
    assert.strictEqual(ticket.priority, "LOW", "Priority override must be ignored")
    assert.strictEqual(ticket.category, "OTHER", "Category override must be ignored")
    assert.strictEqual(ticket.agentId, null, "AgentId override must be ignored")
  })

  test("15. Excessively long title returns HTTP 400", async () => {
    const hugeTitle = "A".repeat(256)
    const res = await fetch(`${baseUrl}/api/tickets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        title: hugeTitle,
        description: "Valid ticket description",
      }),
    })

    assert.strictEqual(res.status, 400)
    const data = (await res.json()) as { error: string }
    assert.match(data.error, /255 characters/i)
  })
})
