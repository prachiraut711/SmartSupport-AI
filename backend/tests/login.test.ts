import { test, describe, before, after } from "node:test"
import assert from "node:assert/strict"
import { Server } from "node:http"
import { AddressInfo } from "node:net"
import jwt from "jsonwebtoken"
import app from "../src/server"
import prisma from "../src/utils/prisma"
import { hashPassword } from "../src/utils/password"

describe("User Login (POST /api/auth/login)", () => {
  let server: Server
  let baseUrl: string
  const customerEmail = "login.customer.test@example.com"
  const agentEmail = "login.agent.test@example.com"
  const customerPassword = "CustomerPass123!"
  const agentPassword = "AgentPass123!"
  let customerId: string
  let agentId: string

  before(async () => {
    // Clean up any stale test users before running
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [customerEmail, agentEmail],
        },
      },
    })

    // Seed test CUSTOMER and AGENT with bcrypt-hashed passwords
    const hashedCustPass = await hashPassword(customerPassword)
    const customer = await prisma.user.create({
      data: {
        name: "Login Customer",
        email: customerEmail,
        password: hashedCustPass,
        role: "CUSTOMER",
      },
    })
    customerId = customer.id

    const hashedAgentPass = await hashPassword(agentPassword)
    const agent = await prisma.user.create({
      data: {
        name: "Login Agent",
        email: agentEmail,
        password: hashedAgentPass,
        role: "AGENT",
      },
    })
    agentId = agent.id

    // Start ephemeral HTTP server on an available port
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo
        baseUrl = `http://localhost:${address.port}`
        resolve()
      })
    })
  })

  after(async () => {
    // Clean up test users so database is not polluted
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [customerEmail, agentEmail],
        },
      },
    })
    await prisma.$disconnect()

    // Stop ephemeral HTTP server
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
  })

  test("1. Valid CUSTOMER login returns HTTP 200 with token and user profile", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: customerEmail,
        password: customerPassword,
      }),
    })

    assert.strictEqual(res.status, 200)
    const data = (await res.json()) as {
      token: string
      user: { id: string; name: string; email: string; role: string }
    }

    assert.ok(data.token, "Response must include JWT token")
    assert.ok(data.user, "Response must include user object")
    assert.strictEqual(data.user.id, customerId)
    assert.strictEqual(data.user.name, "Login Customer")
    assert.strictEqual(data.user.email, customerEmail)
    assert.strictEqual(data.user.role, "CUSTOMER")
  })

  test("2. Valid AGENT login returns HTTP 200 with token and user profile", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: agentEmail,
        password: agentPassword,
      }),
    })

    assert.strictEqual(res.status, 200)
    const data = (await res.json()) as {
      token: string
      user: { id: string; name: string; email: string; role: string }
    }

    assert.ok(data.token, "Response must include JWT token")
    assert.strictEqual(data.user.id, agentId)
    assert.strictEqual(data.user.name, "Login Agent")
    assert.strictEqual(data.user.email, agentEmail)
    assert.strictEqual(data.user.role, "AGENT")
  })

  test("3 & 4. Returned JWT can be verified and contains expected userId and role claims", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: customerEmail,
        password: customerPassword,
      }),
    })

    const data = (await res.json()) as { token: string }
    const token = data.token

    const secret = process.env.JWT_SECRET!
    const decoded = jwt.verify(token, secret) as Record<string, unknown>

    assert.strictEqual(
      decoded.userId,
      customerId,
      "JWT claim userId must match database user id"
    )
    assert.strictEqual(
      decoded.role,
      "CUSTOMER",
      "JWT claim role must match database user role"
    )
    assert.strictEqual(
      "password" in decoded,
      false,
      "JWT claims must never include password"
    )
    assert.strictEqual(
      "passwordHash" in decoded,
      false,
      "JWT claims must never include passwordHash"
    )
  })

  test("5. Wrong password returns HTTP 401 with generic error message", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: customerEmail,
        password: "WrongPassword999!",
      }),
    })

    assert.strictEqual(res.status, 401)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Invalid email or password")
  })

  test("6. Nonexistent email returns HTTP 401 with identical generic error message", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "nonexistent.user@example.com",
        password: "SomePassword123!",
      }),
    })

    assert.strictEqual(res.status, 401)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Invalid email or password")
  })

  test("7. Missing email or password returns HTTP 400", async () => {
    // Missing email
    const resNoEmail = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: customerPassword }),
    })
    assert.strictEqual(resNoEmail.status, 400)

    // Missing password
    const resNoPass = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: customerEmail }),
    })
    assert.strictEqual(resNoPass.status, 400)

    // Empty string fields
    const resEmpty = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "   ", password: "" }),
    })
    assert.strictEqual(resEmpty.status, 400)
  })

  test("8. Response does not contain password or password hash", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: customerEmail,
        password: customerPassword,
      }),
    })

    assert.strictEqual(res.status, 200)
    const data = (await res.json()) as Record<string, unknown>
    const user = data.user as Record<string, unknown>

    assert.strictEqual(
      "password" in data,
      false,
      "Root response must not contain password"
    )
    assert.strictEqual(
      "passwordHash" in data,
      false,
      "Root response must not contain passwordHash"
    )
    assert.strictEqual(
      "password" in user,
      false,
      "User object must not contain password"
    )
    assert.strictEqual(
      "passwordHash" in user,
      false,
      "User object must not contain passwordHash"
    )
  })
})
