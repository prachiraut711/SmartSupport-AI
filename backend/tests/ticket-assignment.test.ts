import { test, describe, before, after } from "node:test"
import assert from "node:assert/strict"
import { Server } from "node:http"
import { AddressInfo } from "node:net"
import app from "../src/server"
import prisma from "../src/utils/prisma"
import { hashPassword } from "../src/utils/password"
import { signToken } from "../src/utils/jwt"
import { TicketResponse, TicketListResponse } from "../src/types/ticket.types"

describe("Ticket Assignment (PATCH /api/tickets/:ticketId/assignment)", () => {
  let server: Server
  let baseUrl: string

  const emailCustA = "assign.custA@example.com"
  const emailCustB = "assign.custB@example.com"
  const emailAgentA = "assign.agentA@example.com"
  const emailAgentB = "assign.agentB@example.com"

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

    // 3. Create ticket for Customer A
    const ticketA = await prisma.ticket.create({
      data: {
        title: "Customer A Billing Issue",
        description: "Discrepancy in monthly subscription invoice",
        status: "OPEN",
        priority: "LOW",
        category: "BILLING",
        customerId: idCustA,
        agentId: null,
      },
    })
    ticketAId = ticketA.id

    // 4. Create ticket for Customer B
    const ticketB = await prisma.ticket.create({
      data: {
        title: "Customer B Auth Issue",
        description: "Cannot reset user password",
        status: "OPEN",
        priority: "HIGH",
        category: "TECHNICAL",
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
    // 23. Test-created records are cleaned up afterward
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

  test("1. Agent A can assign a ticket to Agent A (self-assignment)", async () => {
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
    assert.strictEqual(ticket.id, ticketAId)
    assert.strictEqual(ticket.agentId, idAgentA)
  })

  test("2. Agent A can assign a ticket to Agent B", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}/assignment`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgentA}`,
      },
      body: JSON.stringify({
        agentId: idAgentB,
      }),
    })

    assert.strictEqual(res.status, 200)
    const ticket = (await res.json()) as TicketResponse
    assert.strictEqual(ticket.id, ticketAId)
    assert.strictEqual(ticket.agentId, idAgentB)
  })

  test("3. Agent B can reassign a ticket to Agent A", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}/assignment`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgentB}`,
      },
      body: JSON.stringify({
        agentId: idAgentA,
      }),
    })

    assert.strictEqual(res.status, 200)
    const ticket = (await res.json()) as TicketResponse
    assert.strictEqual(ticket.id, ticketAId)
    assert.strictEqual(ticket.agentId, idAgentA)
  })

  test("4. Agent can assign a ticket belonging to another customer (Customer B)", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketBId}/assignment`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgentA}`,
      },
      body: JSON.stringify({
        agentId: idAgentB,
      }),
    })

    assert.strictEqual(res.status, 200)
    const ticket = (await res.json()) as TicketResponse
    assert.strictEqual(ticket.id, ticketBId)
    assert.strictEqual(ticket.customerId, idCustB)
    assert.strictEqual(ticket.agentId, idAgentB)
  })

  test("5. Agent can unassign a ticket with agentId: null", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}/assignment`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgentA}`,
      },
      body: JSON.stringify({
        agentId: null,
      }),
    })

    assert.strictEqual(res.status, 200)
    const ticket = (await res.json()) as TicketResponse
    assert.strictEqual(ticket.id, ticketAId)
    assert.strictEqual(ticket.agentId, null)
  })

  test("6. Missing agentId property returns 400", async () => {
    const emptyBodies = [{}, { other: "field" }]

    for (const body of emptyBodies) {
      const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}/assignment`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenAgentA}`,
        },
        body: JSON.stringify(body),
      })

      assert.strictEqual(res.status, 400)
      const data = (await res.json()) as { error: string }
      assert.strictEqual(data.error, "Agent ID is required")
    }
  })

  test("7. Invalid agent UUID returns 400", async () => {
    const invalidAgentIds = ["123", "not-a-valid-uuid", "12345678-1234-1234-1234"]

    for (const invalidId of invalidAgentIds) {
      const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}/assignment`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenAgentA}`,
        },
        body: JSON.stringify({
          agentId: invalidId,
        }),
      })

      assert.strictEqual(res.status, 400)
      const data = (await res.json()) as { error: string }
      assert.strictEqual(data.error, "Invalid agent ID")
    }
  })

  test("8. Nonexistent agent UUID returns 404", async () => {
    const nonexistentAgentId = "00000000-0000-0000-0000-000000000000"

    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}/assignment`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgentA}`,
      },
      body: JSON.stringify({
        agentId: nonexistentAgentId,
      }),
    })

    assert.strictEqual(res.status, 404)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Agent not found")
  })

  test("9. Customer ID supplied as agentId returns 400", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}/assignment`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgentA}`,
      },
      body: JSON.stringify({
        agentId: idCustA, // User has role CUSTOMER
      }),
    })

    assert.strictEqual(res.status, 400)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "User is not an agent")
  })

  test("10. Nonexistent ticket returns 404", async () => {
    const nonexistentTicketId = "00000000-0000-0000-0000-000000000000"

    const res = await fetch(`${baseUrl}/api/tickets/${nonexistentTicketId}/assignment`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgentA}`,
      },
      body: JSON.stringify({
        agentId: idAgentA,
      }),
    })

    assert.strictEqual(res.status, 404)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Ticket not found")
  })

  test("11. Invalid ticket UUID returns 400", async () => {
    const invalidTicketIds = ["123", "not-a-valid-uuid", "12345678-1234-1234-1234"]

    for (const invalidId of invalidTicketIds) {
      const res = await fetch(`${baseUrl}/api/tickets/${invalidId}/assignment`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenAgentA}`,
        },
        body: JSON.stringify({
          agentId: idAgentA,
        }),
      })

      assert.strictEqual(res.status, 400)
      const data = (await res.json()) as { error: string }
      assert.strictEqual(data.error, "Invalid ticket ID")
    }
  })

  test("12. Missing Authorization header returns 401", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}/assignment`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agentId: idAgentA,
      }),
    })

    assert.strictEqual(res.status, 401)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Authentication required")
  })

  test("13. Invalid JWT returns 401", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}/assignment`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer invalid.jwt.value",
      },
      body: JSON.stringify({
        agentId: idAgentA,
      }),
    })

    assert.strictEqual(res.status, 401)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Authentication required")
  })

  test("14. CUSTOMER receives 403 on assignment endpoint", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}/assignment`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenCustA}`,
      },
      body: JSON.stringify({
        agentId: idAgentA,
      }),
    })

    assert.strictEqual(res.status, 403)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Forbidden: insufficient permissions")
  })

  test("15 & Section 15. Security allowlist: unallowed fields in request body are strictly ignored", async () => {
    const originalTicket = await prisma.ticket.findUnique({
      where: { id: ticketAId },
    })
    assert.ok(originalTicket)

    const attackRes = await fetch(`${baseUrl}/api/tickets/${ticketAId}/assignment`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgentA}`,
      },
      body: JSON.stringify({
        agentId: idAgentB,
        customerId: "ATTACKER_CUSTOMER_ID",
        status: "CLOSED",
        priority: "URGENT",
        category: "REFUND",
        title: "ATTACKED TITLE",
        description: "ATTACKED DESCRIPTION",
      }),
    })

    assert.strictEqual(attackRes.status, 200)
    const updated = (await attackRes.json()) as TicketResponse

    // 1. agentId DID change to Agent B
    assert.strictEqual(updated.agentId, idAgentB)

    // 2. All other fields remained unchanged
    assert.strictEqual(updated.id, ticketAId, "ticket id cannot be changed")
    assert.strictEqual(updated.customerId, originalTicket.customerId, "customerId cannot be changed")
    assert.strictEqual(updated.status, originalTicket.status, "status cannot be changed")
    assert.strictEqual(updated.priority, originalTicket.priority, "priority cannot be changed")
    assert.strictEqual(updated.category, originalTicket.category, "category cannot be changed")
    assert.strictEqual(updated.title, originalTicket.title, "title cannot be changed")
    assert.strictEqual(updated.description, originalTicket.description, "description cannot be changed")

    // Verify in database
    const dbTicket = await prisma.ticket.findUnique({ where: { id: ticketAId } })
    assert.ok(dbTicket)
    assert.strictEqual(dbTicket.agentId, idAgentB)
    assert.strictEqual(dbTicket.customerId, idCustA)
    assert.strictEqual(dbTicket.status, originalTicket.status)
    assert.strictEqual(dbTicket.priority, originalTicket.priority)
    assert.strictEqual(dbTicket.category, originalTicket.category)
    assert.strictEqual(dbTicket.title, originalTicket.title)
    assert.strictEqual(dbTicket.description, originalTicket.description)
  })

  test("16. Response contains only safe ticket fields", async () => {
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
    const ticket = (await res.json()) as Record<string, unknown>

    assert.strictEqual("password" in ticket, false)
    assert.strictEqual("passwordHash" in ticket, false)
    assert.strictEqual("user" in ticket, false)
    assert.strictEqual("customer" in ticket, false)
    assert.strictEqual("agent" in ticket, false)
  })

  test("17. Existing ticket creation still works", async () => {
    const res = await fetch(`${baseUrl}/api/tickets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenCustA}`,
      },
      body: JSON.stringify({
        title: "Alpha Assignment Regression Ticket",
        description: "Checking ticket creation",
      }),
    })

    assert.strictEqual(res.status, 201)
    const newTicket = (await res.json()) as TicketResponse
    assert.strictEqual(newTicket.title, "Alpha Assignment Regression Ticket")
    assert.strictEqual(newTicket.agentId, null)
  })

  test("18 & 19. Existing customer & agent ticket listing still work", async () => {
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

  test("20 & 21. Existing customer & agent ticket details still work", async () => {
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

  test("22. Existing status/priority/category update endpoint still works", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgentA}`,
      },
      body: JSON.stringify({
        status: "RESOLVED",
        priority: "MEDIUM",
        category: "ACCOUNT",
      }),
    })

    assert.strictEqual(res.status, 200)
    const ticket = (await res.json()) as TicketResponse
    assert.strictEqual(ticket.id, ticketAId)
    assert.strictEqual(ticket.status, "RESOLVED")
    assert.strictEqual(ticket.priority, "MEDIUM")
    assert.strictEqual(ticket.category, "ACCOUNT")
  })
})
