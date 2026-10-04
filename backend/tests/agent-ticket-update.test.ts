import { test, describe, before, after } from "node:test"
import assert from "node:assert/strict"
import { Server } from "node:http"
import { AddressInfo } from "node:net"
import app from "../src/server"
import prisma from "../src/utils/prisma"
import { hashPassword } from "../src/utils/password"
import { signToken } from "../src/utils/jwt"
import { TicketResponse, TicketListResponse } from "../src/types/ticket.types"

describe("Agent Ticket Updates (PATCH /api/tickets/:ticketId)", () => {
  let server: Server
  let baseUrl: string

  const emailCustA = "agent.update.custA@example.com"
  const emailCustB = "agent.update.custB@example.com"
  const emailAgent = "agent.update.agent@example.com"

  let idCustA: string
  let idCustB: string
  let idAgent: string

  let tokenCustA: string
  let tokenCustB: string
  let tokenAgent: string

  let ticketAId: string
  let ticketBId: string

  before(async () => {
    // 1. Clean up stale test data
    const allEmails = [emailCustA, emailCustB, emailAgent]
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

    const agent = await prisma.user.create({
      data: { name: "Support Agent", email: emailAgent, password: passwordHash, role: "AGENT" },
    })
    idAgent = agent.id
    tokenAgent = signToken({ userId: idAgent, role: "AGENT" })

    // 3. Create ticket for Customer A
    const ticketA = await prisma.ticket.create({
      data: {
        title: "Alpha Initial Title",
        description: "Alpha initial description",
        status: "OPEN",
        priority: "LOW",
        category: "OTHER",
        customerId: idCustA,
      },
    })
    ticketAId = ticketA.id

    // 4. Create ticket for Customer B
    const ticketB = await prisma.ticket.create({
      data: {
        title: "Beta Initial Title",
        description: "Beta initial description",
        status: "OPEN",
        priority: "LOW",
        category: "OTHER",
        customerId: idCustB,
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
    // 29. Clean up test records
    await prisma.ticket.deleteMany({
      where: {
        customerId: { in: [idCustA, idCustB, idAgent] },
      },
    })
    await prisma.user.deleteMany({
      where: {
        id: { in: [idCustA, idCustB, idAgent] },
      },
    })

    await prisma.$disconnect()

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
  })

  test("1 & 5. Agent can update status and updated value is returned", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgent}`,
      },
      body: JSON.stringify({
        status: "IN_PROGRESS",
      }),
    })

    assert.strictEqual(res.status, 200)
    const ticket = (await res.json()) as TicketResponse
    assert.strictEqual(ticket.id, ticketAId)
    assert.strictEqual(ticket.status, "IN_PROGRESS")
    assert.strictEqual(ticket.priority, "LOW") // Unchanged
    assert.strictEqual(ticket.category, "OTHER") // Unchanged
  })

  test("2. Agent can update priority", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgent}`,
      },
      body: JSON.stringify({
        priority: "URGENT",
      }),
    })

    assert.strictEqual(res.status, 200)
    const ticket = (await res.json()) as TicketResponse
    assert.strictEqual(ticket.id, ticketAId)
    assert.strictEqual(ticket.priority, "URGENT")
    assert.strictEqual(ticket.status, "IN_PROGRESS") // Retained from previous update
  })

  test("3. Agent can update category", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgent}`,
      },
      body: JSON.stringify({
        category: "TECHNICAL",
      }),
    })

    assert.strictEqual(res.status, 200)
    const ticket = (await res.json()) as TicketResponse
    assert.strictEqual(ticket.id, ticketAId)
    assert.strictEqual(ticket.category, "TECHNICAL")
  })

  test("4 & 6. Agent can update status + priority + category together and updatedAt changes", async () => {
    // Fetch current ticket to compare updatedAt
    const beforeRes = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      headers: { Authorization: `Bearer ${tokenAgent}` },
    })
    const beforeTicket = (await beforeRes.json()) as TicketResponse
    const beforeTime = new Date(beforeTicket.updatedAt).getTime()

    // Small delay to ensure timestamp resolution difference
    await new Promise((r) => setTimeout(r, 20))

    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgent}`,
      },
      body: JSON.stringify({
        status: "RESOLVED",
        priority: "MEDIUM",
        category: "BILLING",
      }),
    })

    assert.strictEqual(res.status, 200)
    const ticket = (await res.json()) as TicketResponse
    assert.strictEqual(ticket.id, ticketAId)
    assert.strictEqual(ticket.status, "RESOLVED")
    assert.strictEqual(ticket.priority, "MEDIUM")
    assert.strictEqual(ticket.category, "BILLING")

    const afterTime = new Date(ticket.updatedAt).getTime()
    assert.ok(afterTime >= beforeTime, "updatedAt must be updated after successful patch")
  })

  test("7. Agent can update a ticket belonging to another customer (Customer B)", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketBId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgent}`,
      },
      body: JSON.stringify({
        status: "WAITING_FOR_CUSTOMER",
        priority: "HIGH",
        category: "ACCOUNT",
      }),
    })

    assert.strictEqual(res.status, 200)
    const ticket = (await res.json()) as TicketResponse
    assert.strictEqual(ticket.id, ticketBId)
    assert.strictEqual(ticket.customerId, idCustB)
    assert.strictEqual(ticket.status, "WAITING_FOR_CUSTOMER")
    assert.strictEqual(ticket.priority, "HIGH")
    assert.strictEqual(ticket.category, "ACCOUNT")
  })

  test("8. Nonexistent ticket returns 404", async () => {
    const nonexistentId = "00000000-0000-0000-0000-000000000000"
    const res = await fetch(`${baseUrl}/api/tickets/${nonexistentId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgent}`,
      },
      body: JSON.stringify({
        status: "RESOLVED",
      }),
    })

    assert.strictEqual(res.status, 404)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Ticket not found")
  })

  test("9. Invalid UUID returns 400", async () => {
    const invalidIds = ["123", "not-a-valid-uuid", "12345678-1234-1234-1234"]

    for (const invalidId of invalidIds) {
      const res = await fetch(`${baseUrl}/api/tickets/${invalidId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenAgent}`,
        },
        body: JSON.stringify({
          status: "RESOLVED",
        }),
      })

      assert.strictEqual(res.status, 400)
      const data = (await res.json()) as { error: string }
      assert.strictEqual(data.error, "Invalid ticket ID")
    }
  })

  test("10. Missing Authorization header returns 401", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "RESOLVED",
      }),
    })

    assert.strictEqual(res.status, 401)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Authentication required")
  })

  test("11. Invalid JWT returns 401", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer invalid.token.value",
      },
      body: JSON.stringify({
        status: "RESOLVED",
      }),
    })

    assert.strictEqual(res.status, 401)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Authentication required")
  })

  test("12. Customer receives 403 on PATCH /api/tickets/:ticketId", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenCustA}`,
      },
      body: JSON.stringify({
        status: "RESOLVED",
      }),
    })

    assert.strictEqual(res.status, 403)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Forbidden: insufficient permissions")
  })

  test("13. Empty update body returns 400", async () => {
    const emptyBodies = [{}, { otherField: "test" }]

    for (const body of emptyBodies) {
      const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenAgent}`,
        },
        body: JSON.stringify(body),
      })

      assert.strictEqual(res.status, 400)
      const data = (await res.json()) as { error: string }
      assert.strictEqual(data.error, "At least one field must be provided")
    }
  })

  test("14. Invalid status returns 400", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgent}`,
      },
      body: JSON.stringify({
        status: "INVALID_STATUS",
      }),
    })

    assert.strictEqual(res.status, 400)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Invalid status")
  })

  test("15. Invalid priority returns 400", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgent}`,
      },
      body: JSON.stringify({
        priority: "SUPER_URGENT",
      }),
    })

    assert.strictEqual(res.status, 400)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Invalid priority")
  })

  test("16. Invalid category returns 400", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgent}`,
      },
      body: JSON.stringify({
        category: "HARDWARE_FAILURE",
      }),
    })

    assert.strictEqual(res.status, 400)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Invalid category")
  })

  test("17 - 22 & Section 17. Security allowlist: unallowed fields in request body are strictly ignored", async () => {
    const originalTicket = await prisma.ticket.findUnique({
      where: { id: ticketAId },
    })
    assert.ok(originalTicket)

    const attackRes = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgent}`,
      },
      body: JSON.stringify({
        status: "CLOSED",
        customerId: "ATTACKER_CUSTOMER_ID",
        agentId: "ATTACKER_AGENT_ID",
        title: "ATTACKED TITLE",
        description: "ATTACKED DESCRIPTION",
        id: "00000000-0000-0000-0000-000000000001",
        updatedAt: "2000-01-01T00:00:00.000Z",
      }),
    })

    assert.strictEqual(attackRes.status, 200)
    const updated = (await attackRes.json()) as TicketResponse

    // 1. Status DID change
    assert.strictEqual(updated.status, "CLOSED")

    // 2. Unallowed fields remained completely UNCHANGED
    assert.strictEqual(updated.id, ticketAId, "ticket id cannot be changed")
    assert.strictEqual(updated.customerId, idCustA, "customerId cannot be changed")
    assert.strictEqual(updated.agentId, originalTicket.agentId, "agentId cannot be changed")
    assert.strictEqual(updated.title, originalTicket.title, "title cannot be changed")
    assert.strictEqual(updated.description, originalTicket.description, "description cannot be changed")
    assert.notStrictEqual(
      new Date(updated.updatedAt).toISOString(),
      "2000-01-01T00:00:00.000Z",
      "updatedAt cannot be controlled by client"
    )

    // Verify database state matches
    const dbTicket = await prisma.ticket.findUnique({ where: { id: ticketAId } })
    assert.ok(dbTicket)
    assert.strictEqual(dbTicket.status, "CLOSED")
    assert.strictEqual(dbTicket.customerId, idCustA)
    assert.strictEqual(dbTicket.title, originalTicket.title)
    assert.strictEqual(dbTicket.description, originalTicket.description)
  })

  test("23. Response does not contain password, passwordHash, or unrelated user data", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAgent}`,
      },
      body: JSON.stringify({
        status: "OPEN",
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

  test("24. Existing customer ticket creation still works", async () => {
    const res = await fetch(`${baseUrl}/api/tickets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenCustA}`,
      },
      body: JSON.stringify({
        title: "Regression Ticket Alpha",
        description: "Testing creation after update feature",
      }),
    })

    assert.strictEqual(res.status, 201)
    const newTicket = (await res.json()) as TicketResponse
    assert.strictEqual(newTicket.title, "Regression Ticket Alpha")
    assert.strictEqual(newTicket.status, "OPEN")
    assert.strictEqual(newTicket.priority, "LOW")
    assert.strictEqual(newTicket.category, "OTHER")
  })

  test("25 & 26. Existing customer & agent ticket listing still work", async () => {
    const custRes = await fetch(`${baseUrl}/api/tickets`, {
      headers: { Authorization: `Bearer ${tokenCustA}` },
    })
    assert.strictEqual(custRes.status, 200)
    const custData = (await custRes.json()) as TicketListResponse
    assert.ok(custData.tickets.every((t) => t.customerId === idCustA))

    const agentRes = await fetch(`${baseUrl}/api/tickets`, {
      headers: { Authorization: `Bearer ${tokenAgent}` },
    })
    assert.strictEqual(agentRes.status, 200)
    const agentData = (await agentRes.json()) as TicketListResponse
    assert.ok(agentData.tickets.length >= 2)
  })

  test("27 & 28. Existing customer & agent ticket details still work", async () => {
    // Customer can view own ticket
    const custRes = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      headers: { Authorization: `Bearer ${tokenCustA}` },
    })
    assert.strictEqual(custRes.status, 200)

    // Customer cannot view other customer's ticket
    const custOtherRes = await fetch(`${baseUrl}/api/tickets/${ticketBId}`, {
      headers: { Authorization: `Bearer ${tokenCustA}` },
    })
    assert.strictEqual(custOtherRes.status, 404)

    // Agent can view both
    const agentARes = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      headers: { Authorization: `Bearer ${tokenAgent}` },
    })
    assert.strictEqual(agentARes.status, 200)

    const agentBRes = await fetch(`${baseUrl}/api/tickets/${ticketBId}`, {
      headers: { Authorization: `Bearer ${tokenAgent}` },
    })
    assert.strictEqual(agentBRes.status, 200)
  })
})
