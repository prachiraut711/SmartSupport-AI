import { test, describe, before, after } from "node:test"
import assert from "node:assert/strict"
import { Server } from "node:http"
import { AddressInfo } from "node:net"
import app from "../src/server"
import prisma from "../src/utils/prisma"
import { hashPassword } from "../src/utils/password"
import { signToken } from "../src/utils/jwt"
import { TicketResponse, TicketListResponse } from "../src/types/ticket.types"

describe("Customer Ticket Details (GET /api/tickets/:ticketId)", () => {
  let server: Server
  let baseUrl: string

  const emailCustomerA = "ticket.details.custA@example.com"
  const emailCustomerB = "ticket.details.custB@example.com"
  const emailAgent = "ticket.details.agent@example.com"

  let idCustomerA: string
  let idCustomerB: string
  let idAgent: string

  let tokenCustomerA: string
  let tokenCustomerB: string
  let tokenAgent: string

  let ticketAId: string
  let ticketBId: string

  before(async () => {
    // 1. Clean up stale test data
    const allEmails = [emailCustomerA, emailCustomerB, emailAgent]
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
      data: { name: "Customer A", email: emailCustomerA, password: passwordHash, role: "CUSTOMER" },
    })
    idCustomerA = custA.id
    tokenCustomerA = signToken({ userId: idCustomerA, role: "CUSTOMER" })

    const custB = await prisma.user.create({
      data: { name: "Customer B", email: emailCustomerB, password: passwordHash, role: "CUSTOMER" },
    })
    idCustomerB = custB.id
    tokenCustomerB = signToken({ userId: idCustomerB, role: "CUSTOMER" })

    const agent = await prisma.user.create({
      data: { name: "Agent User", email: emailAgent, password: passwordHash, role: "AGENT" },
    })
    idAgent = agent.id
    tokenAgent = signToken({ userId: idAgent, role: "AGENT" })

    // 3. Create ticket for Customer A
    const ticketA = await prisma.ticket.create({
      data: {
        title: "Customer A Private Ticket",
        description: "Billing discrepancy on September subscription invoice",
        status: "OPEN",
        priority: "LOW",
        category: "OTHER",
        customerId: idCustomerA,
      },
    })
    ticketAId = ticketA.id

    // 4. Create ticket for Customer B
    const ticketB = await prisma.ticket.create({
      data: {
        title: "Customer B Private Ticket",
        description: "Technical issue with login authentication",
        status: "OPEN",
        priority: "LOW",
        category: "OTHER",
        customerId: idCustomerB,
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
    // Clean up test tickets
    await prisma.ticket.deleteMany({
      where: {
        customerId: { in: [idCustomerA, idCustomerB, idAgent] },
      },
    })

    // Clean up test users
    await prisma.user.deleteMany({
      where: {
        id: { in: [idCustomerA, idCustomerB, idAgent] },
      },
    })

    await prisma.$disconnect()

    // Stop server
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
  })

  test("1 & 2. Customer A can retrieve their own ticket with safe fields", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustomerA}`,
      },
    })

    assert.strictEqual(res.status, 200)
    const ticket = (await res.json()) as TicketResponse

    assert.strictEqual(ticket.id, ticketAId)
    assert.strictEqual(ticket.title, "Customer A Private Ticket")
    assert.strictEqual(ticket.description, "Billing discrepancy on September subscription invoice")
    assert.strictEqual(ticket.status, "OPEN")
    assert.strictEqual(ticket.priority, "LOW")
    assert.strictEqual(ticket.category, "OTHER")
    assert.strictEqual(ticket.customerId, idCustomerA)
    assert.strictEqual(ticket.agentId, null)
    assert.ok(ticket.createdAt)
    assert.ok(ticket.updatedAt)
  })

  test("3. Customer A cannot retrieve Customer B's ticket (returns identical 404)", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketBId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustomerA}`,
      },
    })

    assert.strictEqual(res.status, 404)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Ticket not found")
  })

  test("4. Customer B cannot retrieve Customer A's ticket (returns identical 404)", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustomerB}`,
      },
    })

    assert.strictEqual(res.status, 404)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Ticket not found")
  })

  test("5. Nonexistent ticket ID returns HTTP 404 with identical error message", async () => {
    const nonexistentId = "00000000-0000-0000-0000-000000000000"
    const res = await fetch(`${baseUrl}/api/tickets/${nonexistentId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustomerA}`,
      },
    })

    assert.strictEqual(res.status, 404)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Ticket not found")
  })

  test("6. Invalid ticket ID format returns HTTP 400 with 'Invalid ticket ID'", async () => {
    // Malformed non-UUID strings
    const invalidIds = ["123", "not-a-valid-uuid", "undefined", "12345678-1234-1234-1234"]

    for (const invalidId of invalidIds) {
      const res = await fetch(`${baseUrl}/api/tickets/${invalidId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenCustomerA}`,
        },
      })

      assert.strictEqual(res.status, 400)
      const data = (await res.json()) as { error: string }
      assert.strictEqual(data.error, "Invalid ticket ID")
    }
  })

  test("7. Unauthenticated request returns HTTP 401", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      method: "GET",
    })

    assert.strictEqual(res.status, 401)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Authentication required")
  })

  test("8. Invalid JWT returns HTTP 401", async () => {
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

  test("9. AGENT can retrieve ticket details (HTTP 200)", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenAgent}`,
      },
    })

    assert.strictEqual(res.status, 200)
    const data = (await res.json()) as TicketResponse
    assert.strictEqual(data.id, ticketAId)
  })

  test("10. Response does not contain password or unrelated user data", async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${ticketAId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustomerA}`,
      },
    })

    assert.strictEqual(res.status, 200)
    const ticket = (await res.json()) as Record<string, unknown>

    assert.strictEqual("password" in ticket, false)
    assert.strictEqual("passwordHash" in ticket, false)
    assert.strictEqual("user" in ticket, false)
    assert.strictEqual("customer" in ticket, false)
  })

  test("11. Query parameter manipulation cannot bypass ownership", async () => {
    // Customer A attempts to spoof ownership via query parameter
    const res = await fetch(
      `${baseUrl}/api/tickets/${ticketBId}?customerId=${idCustomerA}&override=true`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenCustomerA}`,
        },
      }
    )

    assert.strictEqual(res.status, 404)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Ticket not found")
  })

  test("12. Existing ticket creation and ticket listing still work", async () => {
    // 1. Create a new ticket
    const createRes = await fetch(`${baseUrl}/api/tickets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenCustomerA}`,
      },
      body: JSON.stringify({
        title: "Customer A Second Ticket",
        description: "Second issue description",
      }),
    })
    assert.strictEqual(createRes.status, 201)
    const newTicket = (await createRes.json()) as TicketResponse

    // 2. List tickets
    const listRes = await fetch(`${baseUrl}/api/tickets`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustomerA}`,
      },
    })
    assert.strictEqual(listRes.status, 200)
    const listData = (await listRes.json()) as TicketListResponse
    assert.strictEqual(listData.tickets.length, 2)

    // 3. Fetch details of newly created ticket
    const detailRes = await fetch(`${baseUrl}/api/tickets/${newTicket.id}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustomerA}`,
      },
    })
    assert.strictEqual(detailRes.status, 200)
    const detailData = (await detailRes.json()) as TicketResponse
    assert.strictEqual(detailData.id, newTicket.id)
    assert.strictEqual(detailData.title, "Customer A Second Ticket")
  })
})
