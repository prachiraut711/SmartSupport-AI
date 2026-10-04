import { test, describe, before, after } from "node:test"
import assert from "node:assert/strict"
import { Server } from "node:http"
import { AddressInfo } from "node:net"
import app from "../src/server"
import prisma from "../src/utils/prisma"
import { hashPassword } from "../src/utils/password"
import { signToken } from "../src/utils/jwt"
import { MessageResponse } from "../src/types/message.types"
import { TicketResponse, TicketListResponse } from "../src/types/ticket.types"

describe("Ticket Message Creation (POST /api/tickets/:ticketId/messages)", () => {
  let server: Server
  let baseUrl: string

  const emailCustA = "msg.custA@example.com"
  const emailCustB = "msg.custB@example.com"
  const emailAgentA = "msg.agentA@example.com"
  const emailAgentB = "msg.agentB@example.com"

  let idCustA: string
  let idCustB: string
  let idAgentA: string
  let idAgentB: string

  let tokenCustA: string
  let tokenCustB: string
  let tokenAgentA: string
  let tokenAgentB: string

  let ticketAId: string
  let ticketBId: string

  before(async () => {
    // 1. Clean up stale test data
    const allEmails = [emailCustA, emailCustB, emailAgentA, emailAgentB]
    await prisma.message.deleteMany({
      where: {
        sender: { email: { in: allEmails } },
      },
    })
    await prisma.ticket.deleteMany({
      where: {
        customer: { email: { in: allEmails } },
      },
    })
    await prisma.user.deleteMany({
      where: {
        email: { in: allEmails },
      },
    })

    // 2. Create users
    const passwordHash = await hashPassword("TestPass123!")

    const custA = await prisma.user.create({
      data: { name: "Customer Alpha", email: emailCustA, password: passwordHash, role: "CUSTOMER" },
    })
    idCustA = custA.id
    tokenCustA = signToken({ userId: idCustA, role: "CUSTOMER" })

    const custB = await prisma.user.create({
      data: { name: "Customer Beta", email: emailCustB, password: passwordHash, role: "CUSTOMER" },
    })
    idCustB = custB.id
    tokenCustB = signToken({ userId: idCustB, role: "CUSTOMER" })

    const agentA = await prisma.user.create({
      data: { name: "Agent Alpha", email: emailAgentA, password: passwordHash, role: "AGENT" },
    })
    idAgentA = agentA.id
    tokenAgentA = signToken({ userId: idAgentA, role: "AGENT" })

    const agentB = await prisma.user.create({
      data: { name: "Agent Beta", email: emailAgentB, password: passwordHash, role: "AGENT" },
    })
    idAgentB = agentB.id
    tokenAgentB = signToken({ userId: idAgentB, role: "AGENT" })

    // 3. Create Ticket A belonging to Customer A (assigned to Agent B initially)
    const ticketA = await prisma.ticket.create({
      data: {
        title: "Alpha Network Problem",
        description: "Network issue details",
        status: "OPEN",
        priority: "LOW",
        category: "TECHNICAL",
        customerId: idCustA,
        agentId: idAgentB,
      },
    })
    ticketAId = ticketA.id

    // 4. Create Ticket B belonging to Customer B (unassigned)
    const ticketB = await prisma.ticket.create({
      data: {
        title: "Beta Billing Problem",
        description: "Billing issue details",
        status: "OPEN",
        priority: "MEDIUM",
        category: "BILLING",
        customerId: idCustB,
        agentId: null,
      },
    })
    ticketBId = ticketB.id

    // 5. Start ephemeral test server
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo
        baseUrl = `http://localhost:${address.port}`
        resolve()
      })
    })
  })

  after(async () => {
    // 27. Test-created records are cleaned up afterward
    const allEmails = [emailCustA, emailCustB, emailAgentA, emailAgentB]
    await prisma.message.deleteMany({
      where: {
        sender: { email: { in: allEmails } },
      },
    })
    await prisma.ticket.deleteMany({
      where: {
        customerId: { in: [idCustA, idCustB, idAgentA, idAgentB] },
      },
    })
    await prisma.user.deleteMany({
      where: {
        id: { in: [idCustA, idCustB, idAgentA, idAgentB] },
      },
    })

    await prisma.$disconnect()

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
  })

  test("1, 6, 7 & 8. Customer A can reply to Ticket A -> 201 with correct senderId, ticketId, and isInternal=false", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenCustA}`,
      },
      body: JSON.stringify({
        content: "Customer A reply text",
      }),
    })

    assert.strictEqual(res.status, 201)
    const message = (await res.json()) as MessageResponse
    assert.ok(message.id)
    assert.strictEqual(message.content, "Customer A reply text")
    assert.strictEqual(message.senderId, idCustA)
    assert.strictEqual(message.ticketId, ticketAId)
    assert.strictEqual(message.isInternal, false)
    assert.ok(message.createdAt)
  })

  test("2. Customer A cannot reply to Ticket B (belongs to Customer B) -> 404", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketBId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenCustA}`,
      },
      body: JSON.stringify({
        content: "Trying to reply to another customer's ticket",
      }),
    })

    assert.strictEqual(res.status, 404)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Ticket not found")
  })

  test("3 & 5. Agent A can reply to Ticket A even when assigned to Agent B -> 201", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgentA}`,
      },
      body: JSON.stringify({
        content: "Agent A reply on Ticket A",
      }),
    })

    assert.strictEqual(res.status, 201)
    const message = (await res.json()) as MessageResponse
    assert.strictEqual(message.content, "Agent A reply on Ticket A")
    assert.strictEqual(message.senderId, idAgentA)
    assert.strictEqual(message.ticketId, ticketAId)
    assert.strictEqual(message.isInternal, false)
  })

  test("4 & 5. Agent A can reply to Ticket B (unassigned) -> 201", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketBId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgentA}`,
      },
      body: JSON.stringify({
        content: "Agent A reply on unassigned Ticket B",
      }),
    })

    assert.strictEqual(res.status, 201)
    const message = (await res.json()) as MessageResponse
    assert.strictEqual(message.content, "Agent A reply on unassigned Ticket B")
    assert.strictEqual(message.senderId, idAgentA)
    assert.strictEqual(message.ticketId, ticketBId)
    assert.strictEqual(message.isInternal, false)
  })

  test("9, 10, 11 & Section 15. Security allowlist: client cannot override senderId, ticketId, or set isInternal=true", async () => {
    const attackRes = await fetch(`${baseUrl}/api/tickets/${ticketAId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenCustA}`,
      },
      body: JSON.stringify({
        content: "Real reply",
        senderId: "ATTACKER_USER_ID",
        ticketId: "00000000-0000-0000-0000-000000000001",
        isInternal: true,
      }),
    })

    assert.strictEqual(attackRes.status, 201)
    const message = (await attackRes.json()) as MessageResponse

    assert.strictEqual(message.content, "Real reply")
    assert.strictEqual(message.senderId, idCustA, "senderId must be authenticated user ID")
    assert.strictEqual(message.ticketId, ticketAId, "ticketId must be URL parameter")
    assert.strictEqual(message.isInternal, false, "isInternal must strictly be false")

    // Verify record in PostgreSQL database
    const dbRecord = await prisma.message.findUnique({
      where: { id: message.id },
    })
    assert.ok(dbRecord)
    assert.strictEqual(dbRecord.content, "Real reply")
    assert.strictEqual(dbRecord.senderId, idCustA)
    assert.strictEqual(dbRecord.ticketId, ticketAId)
    assert.strictEqual(dbRecord.isInternal, false)
  })

  test("12. Missing content -> 400", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenCustA}`,
      },
      body: JSON.stringify({}),
    })

    assert.strictEqual(res.status, 400)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Message content is required")
  })

  test("13. Empty content -> 400", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenCustA}`,
      },
      body: JSON.stringify({
        content: "",
      }),
    })

    assert.strictEqual(res.status, 400)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Message content is required")
  })

  test("14. Whitespace-only content -> 400", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenCustA}`,
      },
      body: JSON.stringify({
        content: "     ",
      }),
    })

    assert.strictEqual(res.status, 400)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Message content is required")
  })

  test("15. Leading and trailing whitespace is trimmed before storing", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenCustA}`,
      },
      body: JSON.stringify({
        content: "   Hello, this is trimmed.   ",
      }),
    })

    assert.strictEqual(res.status, 201)
    const message = (await res.json()) as MessageResponse
    assert.strictEqual(message.content, "Hello, this is trimmed.")
  })

  test("16. Content over 5000 characters -> 400", async () => {
    const longContent = "a".repeat(5001)

    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenCustA}`,
      },
      body: JSON.stringify({
        content: longContent,
      }),
    })

    assert.strictEqual(res.status, 400)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Message content must be 5000 characters or less")
  })

  test("17. Invalid ticket UUID -> 400", async () => {
    const invalidIds = ["123", "not-a-valid-uuid", "12345678-1234-1234-1234"]

    for (const invalidId of invalidIds) {
      const res = await fetch(`${baseUrl}/api/tickets/${invalidId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenCustA}`,
        },
        body: JSON.stringify({
          content: "Valid content",
        }),
      })

      assert.strictEqual(res.status, 400)
      const data = (await res.json()) as { error: string }
      assert.strictEqual(data.error, "Invalid ticket ID")
    }
  })

  test("18. Nonexistent ticket -> 404", async () => {
    const nonexistentId = "00000000-0000-0000-0000-000000000000"

    const res = await fetch(`${baseUrl}/api/tickets/${nonexistentId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgentA}`,
      },
      body: JSON.stringify({
        content: "Valid content",
      }),
    })

    assert.strictEqual(res.status, 404)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Ticket not found")
  })

  test("19. Missing Authorization header -> 401", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: "Valid content",
      }),
    })

    assert.strictEqual(res.status, 401)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Authentication required")
  })

  test("20. Invalid JWT -> 401", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer invalid.jwt.value",
      },
      body: JSON.stringify({
        content: "Valid content",
      }),
    })

    assert.strictEqual(res.status, 401)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Authentication required")
  })

  test("21. Response contains only safe message fields", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenCustA}`,
      },
      body: JSON.stringify({
        content: "Checking safe fields",
      }),
    })

    assert.strictEqual(res.status, 201)
    const message = (await res.json()) as Record<string, unknown>

    assert.ok(message.id)
    assert.ok(message.content)
    assert.ok(message.ticketId)
    assert.ok(message.senderId)
    assert.strictEqual(typeof message.isInternal, "boolean")
    assert.ok(message.createdAt)

    // Security assertions: no passwords or user relations
    assert.strictEqual("password" in message, false)
    assert.strictEqual("passwordHash" in message, false)
    assert.strictEqual("user" in message, false)
    assert.strictEqual("sender" in message, false)
    assert.strictEqual("ticket" in message, false)
  })

  test("22. Existing ticket creation still works", async () => {
    const res = await fetch(`${baseUrl}/api/tickets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenCustA}`,
      },
      body: JSON.stringify({
        title: "Ticket After Messages Added",
        description: "Testing creation",
      }),
    })

    assert.strictEqual(res.status, 201)
    const ticket = (await res.json()) as TicketResponse
    assert.strictEqual(ticket.title, "Ticket After Messages Added")
  })

  test("23. Existing ticket listing still works", async () => {
    const custRes = await fetch(`${baseUrl}/api/tickets`, {
      headers: { Authorization: `Bearer ${tokenCustA}` },
    })
    assert.strictEqual(custRes.status, 200)
    const custData = (await custRes.json()) as TicketListResponse
    assert.ok(custData.tickets.every((t) => t.customerId === idCustA))

    const agentRes = await fetch(`${baseUrl}/api/tickets`, {
      headers: { Authorization: `Bearer ${tokenAgentA}` },
    })
    assert.strictEqual(agentRes.status, 200)
    const agentData = (await agentRes.json()) as TicketListResponse
    assert.ok(agentData.tickets.length >= 2)
  })

  test("24. Existing ticket details still work", async () => {
    const custRes = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      headers: { Authorization: `Bearer ${tokenCustA}` },
    })
    assert.strictEqual(custRes.status, 200)

    const custOtherRes = await fetch(`${baseUrl}/api/tickets/${ticketBId}`, {
      headers: { Authorization: `Bearer ${tokenCustA}` },
    })
    assert.strictEqual(custOtherRes.status, 404)

    const agentRes = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      headers: { Authorization: `Bearer ${tokenAgentA}` },
    })
    assert.strictEqual(agentRes.status, 200)
  })

  test("25. Existing ticket update still works", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgentA}`,
      },
      body: JSON.stringify({
        status: "IN_PROGRESS",
      }),
    })

    assert.strictEqual(res.status, 200)
    const ticket = (await res.json()) as TicketResponse
    assert.strictEqual(ticket.status, "IN_PROGRESS")
  })

  test("26. Existing ticket assignment still works", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}/assignment`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgentA}`,
      },
      body: JSON.stringify({
        agentId: idAgentA,
      }),
    })

    assert.strictEqual(res.status, 200)
    const ticket = (await res.json()) as TicketResponse
    assert.strictEqual(ticket.agentId, idAgentA)
  })
})
