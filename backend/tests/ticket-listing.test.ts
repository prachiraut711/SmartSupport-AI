import { test, describe, before, after } from "node:test"
import assert from "node:assert/strict"
import { Server } from "node:http"
import { AddressInfo } from "node:net"
import app from "../src/server"
import prisma from "../src/utils/prisma"
import { hashPassword } from "../src/utils/password"
import { signToken } from "../src/utils/jwt"
import { TicketResponse, TicketListResponse } from "../src/types/ticket.types"

describe("Customer Ticket Listing (GET /api/tickets)", () => {
  let server: Server
  let baseUrl: string

  const emailCustomerA = "ticket.list.custA@example.com"
  const emailCustomerB = "ticket.list.custB@example.com"
  const emailCustomerEmpty = "ticket.list.empty@example.com"
  const emailAgent = "ticket.list.agent@example.com"

  let idCustomerA: string
  let idCustomerB: string
  let idCustomerEmpty: string
  let idAgent: string

  let tokenCustomerA: string
  let tokenCustomerB: string
  let tokenCustomerEmpty: string
  let tokenAgent: string

  let ticketA1Id: string
  let ticketA2Id: string
  let ticketB1Id: string

  before(async () => {
    // 1. Clean up stale test data
    const allEmails = [emailCustomerA, emailCustomerB, emailCustomerEmpty, emailAgent]
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

    const custEmpty = await prisma.user.create({
      data: { name: "Customer Empty", email: emailCustomerEmpty, password: passwordHash, role: "CUSTOMER" },
    })
    idCustomerEmpty = custEmpty.id
    tokenCustomerEmpty = signToken({ userId: idCustomerEmpty, role: "CUSTOMER" })

    const agent = await prisma.user.create({
      data: { name: "Agent User", email: emailAgent, password: passwordHash, role: "AGENT" },
    })
    idAgent = agent.id
    tokenAgent = signToken({ userId: idAgent, role: "AGENT" })

    // 3. Create tickets for Customer A (ticket 1 older, ticket 2 newer)
    const tA1 = await prisma.ticket.create({
      data: {
        title: "Customer A Ticket 1 (Older)",
        description: "Older ticket description",
        status: "OPEN",
        priority: "LOW",
        category: "OTHER",
        customerId: idCustomerA,
        createdAt: new Date(Date.now() - 10000), // 10s earlier
      },
    })
    ticketA1Id = tA1.id

    const tA2 = await prisma.ticket.create({
      data: {
        title: "Customer A Ticket 2 (Newer)",
        description: "Newer ticket description",
        status: "OPEN",
        priority: "LOW",
        category: "OTHER",
        customerId: idCustomerA,
        createdAt: new Date(), // Now
      },
    })
    ticketA2Id = tA2.id

    // 4. Create ticket for Customer B
    const tB1 = await prisma.ticket.create({
      data: {
        title: "Customer B Ticket 1",
        description: "Customer B private ticket description",
        status: "OPEN",
        priority: "LOW",
        category: "OTHER",
        customerId: idCustomerB,
      },
    })
    ticketB1Id = tB1.id

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
        customerId: { in: [idCustomerA, idCustomerB, idCustomerEmpty, idAgent] },
      },
    })

    // Clean up test users
    await prisma.user.deleteMany({
      where: {
        id: { in: [idCustomerA, idCustomerB, idCustomerEmpty, idAgent] },
      },
    })

    await prisma.$disconnect()

    // Stop server
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
  })

  test("1, 2, 3. Customer A receives HTTP 200 with ONLY their own tickets and CANNOT see Customer B's tickets", async () => {
    const res = await fetch(`${baseUrl}/api/tickets`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustomerA}`,
      },
    })

    assert.strictEqual(res.status, 200)
    const data = (await res.json()) as TicketListResponse

    assert.ok(Array.isArray(data.tickets), "Response must have tickets array")
    assert.strictEqual(data.tickets.length, 2, "Customer A must have exactly 2 tickets")

    // Every returned ticket must belong to Customer A
    for (const ticket of data.tickets) {
      assert.strictEqual(
        ticket.customerId,
        idCustomerA,
        "Every returned ticket must belong strictly to Customer A"
      )
      assert.notStrictEqual(
        ticket.customerId,
        idCustomerB,
        "Customer B's ID must never appear in Customer A's tickets"
      )
      assert.notStrictEqual(
        ticket.id,
        ticketB1Id,
        "Customer B's ticket ID must never be returned to Customer A"
      )
    }
  })

  test("Customer B receives ONLY their own tickets and CANNOT see Customer A's tickets", async () => {
    const res = await fetch(`${baseUrl}/api/tickets`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustomerB}`,
      },
    })

    assert.strictEqual(res.status, 200)
    const data = (await res.json()) as TicketListResponse

    assert.strictEqual(data.tickets.length, 1, "Customer B must have exactly 1 ticket")
    assert.strictEqual(data.tickets[0].id, ticketB1Id)
    assert.strictEqual(data.tickets[0].customerId, idCustomerB)
  })

  test("4. Customer with no tickets receives HTTP 200 with an empty array", async () => {
    const res = await fetch(`${baseUrl}/api/tickets`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustomerEmpty}`,
      },
    })

    assert.strictEqual(res.status, 200)
    const data = (await res.json()) as TicketListResponse

    assert.deepStrictEqual(data, { tickets: [] })
  })

  test("5. Results are ordered newest first (createdAt DESC)", async () => {
    const res = await fetch(`${baseUrl}/api/tickets`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustomerA}`,
      },
    })

    assert.strictEqual(res.status, 200)
    const data = (await res.json()) as TicketListResponse

    assert.strictEqual(data.tickets[0].id, ticketA2Id, "Newer ticket must appear first")
    assert.strictEqual(data.tickets[1].id, ticketA1Id, "Older ticket must appear second")

    const time0 = new Date(data.tickets[0].createdAt).getTime()
    const time1 = new Date(data.tickets[1].createdAt).getTime()
    assert.ok(time0 >= time1, "Timestamps must be descending")
  })

  test("6 & 7. Returned tickets contain safe fields and no password or unrelated user data", async () => {
    const res = await fetch(`${baseUrl}/api/tickets`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustomerA}`,
      },
    })

    assert.strictEqual(res.status, 200)
    const data = (await res.json()) as TicketListResponse
    const ticket = data.tickets[0]

    assert.ok(ticket.id)
    assert.ok(ticket.title)
    assert.ok(ticket.description)
    assert.ok(ticket.status)
    assert.ok(ticket.priority)
    assert.ok(ticket.category)
    assert.ok(ticket.customerId)
    assert.strictEqual(ticket.agentId, null)
    assert.ok(ticket.createdAt)
    assert.ok(ticket.updatedAt)

    // Security: no passwords or user data
    assert.strictEqual("password" in ticket, false)
    assert.strictEqual("passwordHash" in ticket, false)
    assert.strictEqual("user" in ticket, false)
    assert.strictEqual("customer" in ticket, false)
  })

  test("8. Unauthenticated request returns HTTP 401", async () => {
    const res = await fetch(`${baseUrl}/api/tickets`, {
      method: "GET",
    })

    assert.strictEqual(res.status, 401)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Authentication required")
  })

  test("9. Invalid JWT returns HTTP 401", async () => {
    const res = await fetch(`${baseUrl}/api/tickets`, {
      method: "GET",
      headers: {
        Authorization: "Bearer bad.jwt.token",
      },
    })

    assert.strictEqual(res.status, 401)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Authentication required")
  })

  test("10. AGENT request receives HTTP 200 with agent queue", async () => {
    const res = await fetch(`${baseUrl}/api/tickets`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenAgent}`,
      },
    })

    assert.strictEqual(res.status, 200)
    const data = (await res.json()) as TicketListResponse
    assert.ok(Array.isArray(data.tickets))
  })

  test("11. Client cannot influence ownership through query parameters (?customerId=...)", async () => {
    // Customer A attempts to pass Customer B's customerId in query parameter
    const res = await fetch(`${baseUrl}/api/tickets?customerId=${idCustomerB}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustomerA}`,
      },
    })

    assert.strictEqual(res.status, 200)
    const data = (await res.json()) as TicketListResponse

    // Query parameter is completely ignored; only Customer A's tickets are returned
    assert.strictEqual(data.tickets.length, 2)
    for (const ticket of data.tickets) {
      assert.strictEqual(ticket.customerId, idCustomerA)
      assert.notStrictEqual(ticket.customerId, idCustomerB)
    }
  })

  test("12. Existing ticket creation still works and increments customer ticket list", async () => {
    // Create new ticket for Customer A
    const createRes = await fetch(`${baseUrl}/api/tickets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenCustomerA}`,
      },
      body: JSON.stringify({
        title: "Brand New Third Ticket",
        description: "Checking that listing dynamically updates with new ticket",
      }),
    })

    assert.strictEqual(createRes.status, 201)
    const newTicket = (await createRes.json()) as TicketResponse

    // List tickets for Customer A again
    const listRes = await fetch(`${baseUrl}/api/tickets`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenCustomerA}`,
      },
    })

    assert.strictEqual(listRes.status, 200)
    const listData = (await listRes.json()) as TicketListResponse

    assert.strictEqual(listData.tickets.length, 3, "Customer A now has 3 tickets")
    assert.strictEqual(listData.tickets[0].id, newTicket.id, "Newly created ticket appears first")
  })
})
