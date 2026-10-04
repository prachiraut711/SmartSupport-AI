import { test, describe, before, after } from "node:test"
import assert from "node:assert/strict"
import express, { Request, Response } from "express"
import { Server } from "node:http"
import { AddressInfo } from "node:net"
import jwt from "jsonwebtoken"
import { authenticateToken } from "../src/middleware/auth.middleware"
import { requireRole } from "../src/middleware/role.middleware"
import { errorHandler } from "../src/middleware/error.middleware"
import { signToken } from "../src/utils/jwt"

describe("Authentication & Role Authorization Middleware", () => {
  let server: Server
  let baseUrl: string

  let customerToken: string
  let agentToken: string
  let expiredToken: string

  before(async () => {
    // Generate valid test tokens using existing JWT signing utility
    customerToken = signToken({
      userId: "cust-uuid-111",
      role: "CUSTOMER",
    })

    agentToken = signToken({
      userId: "agent-uuid-222",
      role: "AGENT",
    })

    // Generate expired token for testing
    const secret =
      process.env.JWT_SECRET || "dev_jwt_secret_smartsupport_ai_key_local"
    expiredToken = jwt.sign(
      { userId: "exp-uuid-333", role: "CUSTOMER" },
      secret,
      { expiresIn: "-1s" }
    )

    // Build focused test application
    const app = express()
    app.use(express.json())

    // 1. Route protected by authenticateToken
    app.get("/test/protected", authenticateToken, (req: Request, res: Response) => {
      res.status(200).json({
        message: "authenticated",
        user: req.user,
      })
    })

    // 2. Route protected by CUSTOMER role
    app.get(
      "/test/customer-only",
      authenticateToken,
      requireRole("CUSTOMER"),
      (req: Request, res: Response) => {
        res.status(200).json({
          message: "customer authorized",
          role: req.user?.role,
        })
      }
    )

    // 3. Route protected by AGENT role
    app.get(
      "/test/agent-only",
      authenticateToken,
      requireRole("AGENT"),
      (req: Request, res: Response) => {
        res.status(200).json({
          message: "agent authorized",
          role: req.user?.role,
        })
      }
    )

    // 4. Route protected by role middleware directly without authenticateToken (tests missing req.user)
    app.get(
      "/test/missing-user-role",
      requireRole("CUSTOMER"),
      (_req: Request, res: Response) => {
        res.status(200).json({ message: "should not be reached" })
      }
    )

    // Error handler
    app.use(errorHandler)

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
    // Close ephemeral server
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
  })

  test("1. Valid CUSTOMER JWT is accepted with HTTP 200", async () => {
    const res = await fetch(`${baseUrl}/test/protected`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${customerToken}`,
      },
    })

    assert.strictEqual(res.status, 200)
    const data = (await res.json()) as { message: string; user: { userId: string; role: string } }
    assert.strictEqual(data.message, "authenticated")
    assert.strictEqual(data.user.userId, "cust-uuid-111")
    assert.strictEqual(data.user.role, "CUSTOMER")
  })

  test("2. Valid AGENT JWT is accepted with HTTP 200", async () => {
    const res = await fetch(`${baseUrl}/test/protected`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${agentToken}`,
      },
    })

    assert.strictEqual(res.status, 200)
    const data = (await res.json()) as { message: string; user: { userId: string; role: string } }
    assert.strictEqual(data.message, "authenticated")
    assert.strictEqual(data.user.userId, "agent-uuid-222")
    assert.strictEqual(data.user.role, "AGENT")
  })

  test("3. Missing Authorization header returns HTTP 401", async () => {
    const res = await fetch(`${baseUrl}/test/protected`, {
      method: "GET",
    })

    assert.strictEqual(res.status, 401)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Authentication required")
  })

  test("4. Invalid token returns HTTP 401", async () => {
    const res = await fetch(`${baseUrl}/test/protected`, {
      method: "GET",
      headers: {
        Authorization: "Bearer invalid.signature.token",
      },
    })

    assert.strictEqual(res.status, 401)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Authentication required")
  })

  test("5. Malformed Authorization header returns HTTP 401", async () => {
    // Non-Bearer scheme
    const resBasic = await fetch(`${baseUrl}/test/protected`, {
      method: "GET",
      headers: {
        Authorization: "Basic dXNlcjpwYXNz",
      },
    })
    assert.strictEqual(resBasic.status, 401)
    const dataBasic = (await resBasic.json()) as { error: string }
    assert.strictEqual(dataBasic.error, "Authentication required")

    // Missing token after Bearer
    const resEmptyBearer = await fetch(`${baseUrl}/test/protected`, {
      method: "GET",
      headers: {
        Authorization: "Bearer ",
      },
    })
    assert.strictEqual(resEmptyBearer.status, 401)

    // Token without Bearer keyword
    const resNoKeyword = await fetch(`${baseUrl}/test/protected`, {
      method: "GET",
      headers: {
        Authorization: "just_a_raw_token_string",
      },
    })
    assert.strictEqual(resNoKeyword.status, 401)
  })

  test("6. Expired token returns HTTP 401", async () => {
    const res = await fetch(`${baseUrl}/test/protected`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${expiredToken}`,
      },
    })

    assert.strictEqual(res.status, 401)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Authentication required")
  })

  test("7. requireRole('CUSTOMER') allows CUSTOMER with HTTP 200", async () => {
    const res = await fetch(`${baseUrl}/test/customer-only`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${customerToken}`,
      },
    })

    assert.strictEqual(res.status, 200)
    const data = (await res.json()) as { message: string; role: string }
    assert.strictEqual(data.message, "customer authorized")
    assert.strictEqual(data.role, "CUSTOMER")
  })

  test("8. requireRole('CUSTOMER') rejects AGENT with HTTP 403", async () => {
    const res = await fetch(`${baseUrl}/test/customer-only`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${agentToken}`,
      },
    })

    assert.strictEqual(res.status, 403)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Forbidden: insufficient permissions")
  })

  test("9. requireRole('AGENT') allows AGENT with HTTP 200", async () => {
    const res = await fetch(`${baseUrl}/test/agent-only`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${agentToken}`,
      },
    })

    assert.strictEqual(res.status, 200)
    const data = (await res.json()) as { message: string; role: string }
    assert.strictEqual(data.message, "agent authorized")
    assert.strictEqual(data.role, "AGENT")
  })

  test("10. requireRole('AGENT') rejects CUSTOMER with HTTP 403", async () => {
    const res = await fetch(`${baseUrl}/test/agent-only`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${customerToken}`,
      },
    })

    assert.strictEqual(res.status, 403)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Forbidden: insufficient permissions")
  })

  test("11. Missing req.user for role middleware returns HTTP 401", async () => {
    const res = await fetch(`${baseUrl}/test/missing-user-role`, {
      method: "GET",
    })

    assert.strictEqual(res.status, 401)
    const data = (await res.json()) as { error: string }
    assert.strictEqual(data.error, "Authentication required")
  })
})
