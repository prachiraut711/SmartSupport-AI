import { test, describe, before, after } from "node:test"
import assert from "node:assert/strict"
import { Server } from "node:http"
import { AddressInfo } from "node:net"
import app from "../src/server"
import prisma from "../src/utils/prisma"
import { hashPassword } from "../src/utils/password"
import { signToken } from "../src/utils/jwt"
import { TicketResponse, TicketListResponse } from "../src/types/ticket.types"

describe("Agent Ticket Details (GET /api/tickets/:ticketId)", () => {
  let server: Server
  let baseUrl: string

  const emailCustA = "agent.details.custA@example.com"
  const emailCustB = "agent.details.custB@example.com"
  const emailAgent = "agent.details.agent@example.com"

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
        title: "Alpha Network Connectivity Issue",
        description: "Experiencing intermittent VPN disconnects during meetings",
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
        title: "Beta Billing Query",
        description: "Need clarification on invoice item #49281",
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
    // 14. Test-created users and tickets are cleaned up afterward
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

  test("1. AGENT can retrieve Customer A's ticket -> HTTP 200", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenAgent}`,
      },
    })

    assert.strictEqual(res.status, 200)
    const ticket = (await res.json()) as TicketResponse
    assert.strictEqual(ticket.id, ticketAId)
    assert.strictEqual(ticket.customerId, idCustA)
    assert.strictEqual(ticket.title, "Alpha Network Connectivity Issue")
  })

  test("2. AGENT can retrieve Customer B's ticket -> HTTP 200", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketBId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenAgent}`,
      },
    })

    assert.strictEqual(res.status, 200)
    const ticket = (await res.json()) as TicketResponse
    assert.strictEqual(ticket.id, ticketBId)
    assert.strictEqual(ticket.customerId, idCustB)
    assert.strictEqual(ticket.title, "Beta Billing Query")
  })

  test("3. AGENT response contains expected safe ticket fields", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenAgent}`,
      },
    })

    assert.strictEqual(res.status, 200)
    const ticket = (await res.json()) as TicketResponse

    assert.strictEqual(ticket.id, ticketAId)
    assert.strictEqual(ticket.title, "Alpha Network Connectivity Issue")
    assert.strictEqual(ticket.description, "Experiencing intermittent VPN disconnects during meetings")
    assert.strictEqual(ticket.status, "OPEN")
    assert.strictEqual(ticket.priority, "LOW")
    assert.strictEqual(ticket.category, "OTHER")
    assert.strictEqual(ticket.customerId, idCustA)
    assert.strictEqual(ticket.agentId, null)
    assert.ok(ticket.createdAt)
    assert.ok(ticket.updatedAt)
  })

  test("4. AGENT receives 404 for nonexistent ticket", async () => {
    const nonexistentId = "00000000-0000-0000-0000-000000000000"
    const res = await fetch(`${baseUrl}/api/tickets/${nonexistentId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenAgent}`,
      },
    })

    assert.strictEqual(res.status, 404)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Ticket not found")
  })

  test("5. Invalid ticket UUID returns 400", async () => {
    const invalidIds = ["123", "not-a-valid-uuid", "abcdefg", "12345678-1234-1234-1234"]

    for (const invalidId of invalidIds) {
      const res = await fetch(`${baseUrl}/api/tickets/${invalidId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenAgent}`,
        },
      })

      assert.strictEqual(res.status, 400)
      const data = (await res.json()) as { error: string }
      assert.strictEqual(data.error, "Invalid ticket ID")
    }
  })

  test("6. CUSTOMER can still retrieve their own ticket", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustA}`,
      },
    })

    assert.strictEqual(res.status, 200)
    const ticket = (await res.json()) as TicketResponse
    assert.strictEqual(ticket.id, ticketAId)
    assert.strictEqual(ticket.customerId, idCustA)
  })

  test("7. CUSTOMER cannot retrieve another customer's ticket -> 404", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketBId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustA}`,
      },
    })

    assert.strictEqual(res.status, 404)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Ticket not found")
  })

  test("8. Missing Authorization header -> 401", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      method: "GET",
    })

    assert.strictEqual(res.status, 401)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Authentication required")
  })

  test("9. Invalid JWT -> 401", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      method: "GET",
      headers: {
        Authorization: "Bearer invalid.jwt.token",
      },
    })

    assert.strictEqual(res.status, 401)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Authentication required")
  })

  test("10. No password/passwordHash/unrelated user data is returned", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenAgent}`,
      },
    })

    assert.strictEqual(res.status, 200)
    const ticket = (await res.json()) as Record<string, unknown>

    assert.strictEqual("password" in ticket, false)
    assert.strictEqual("passwordHash" in ticket, false)
    assert.strictEqual("user" in ticket, false)
    assert.strictEqual("customer" in ticket, false)
    assert.strictEqual("agent" in ticket, false)
  })

  test("11. Query parameter manipulation cannot bypass CUSTOMER ownership", async () => {
    // Customer A attempts to supply Customer B's customerId or bypass parameter
    const res = await fetch(
      `${baseUrl}/api/tickets/${ticketBId}?customerId=${idCustA}&override=true`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenCustA}`,
        },
      }
    )

    assert.strictEqual(res.status, 404)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Ticket not found")
  })

  test("12. Existing GET /api/tickets behavior remains correct for both CUSTOMER and AGENT", async () => {
    // CUSTOMER sees only own tickets
    const custRes = await fetch(`${baseUrl}/api/tickets`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustA}`,
      },
    })
    assert.strictEqual(custRes.status, 200)
    const custData = (await custRes.json()) as TicketListResponse
    assert.strictEqual(custData.tickets.length, 1)
    assert.strictEqual(custData.tickets[0].id, ticketAId)

    // AGENT sees tickets across customers
    const agentRes = await fetch(`${baseUrl}/api/tickets`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenAgent}`,
      },
    })
    assert.strictEqual(agentRes.status, 200)
    const agentData = (await agentRes.json()) as TicketListResponse
    const ids = agentData.tickets.map((t) => t.id)
    assert.ok(ids.includes(ticketAId))
    assert.ok(ids.includes(ticketBId))
  })

  test("13. Existing ticket creation still works", async () => {
    const res = await fetch(`${baseUrl}/api/tickets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenCustA}`,
      },
      body: JSON.stringify({
        title: "Alpha Second Ticket",
        description: "Checking details on another created ticket",
      }),
    })

    assert.strictEqual(res.status, 201)
    const newTicket = (await res.json()) as TicketResponse

    // AGENT can immediately view the newly created ticket
    const agentRes = await fetch(`${baseUrl}/api/tickets/${newTicket.id}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenAgent}`,
      },
    })
    assert.strictEqual(agentRes.status, 200)
    const fetched = (await agentRes.json()) as TicketResponse
    assert.strictEqual(fetched.id, newTicket.id)
    assert.strictEqual(fetched.title, "Alpha Second Ticket")
  })
})
