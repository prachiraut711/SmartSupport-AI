import { Request, Response, NextFunction } from "express"
import { Role } from "@prisma/client"
import { verifyToken } from "../utils/jwt"
import { AppError } from "./error.middleware"

/**
 * Authentication middleware that verifies the incoming Bearer JWT.
 *
 * 1. Checks Authorization header for "Bearer <token>" format.
 * 2. Verifies token signature and expiration via verifyToken utility.
 * 3. Extracts safe claims (userId, role) and attaches them to req.user.
 * 4. Rejects invalid, missing, or expired tokens with HTTP 401 "Authentication required".
 */
export const authenticateToken = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization

  // 1. Missing Authorization header
  if (!authHeader) {
    return next(new AppError("Authentication required", 401))
  }

  // 2. Expect "Bearer <token>" format
  const parts = authHeader.split(" ")
  if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1].trim()) {
    return next(new AppError("Authentication required", 401))
  }

  const token = parts[1].trim()

  try {
    // 3. Verify token with configured secret
    const payload = verifyToken(token)

    // 4. Validate payload contains expected claims
    if (!payload.userId || !payload.role) {
      return next(new AppError("Authentication required", 401))
    }

    // Role must be CUSTOMER or AGENT
    if (payload.role !== Role.CUSTOMER && payload.role !== Role.AGENT) {
      return next(new AppError("Authentication required", 401))
    }

    // 5. Attach safe user to request
    req.user = {
      userId: payload.userId,
      role: payload.role,
    }

    next()
  } catch (_error) {
    // Token is expired, invalid signature, or malformed
    return next(new AppError("Authentication required", 401))
  }
}

export const authMiddleware = authenticateToken
export default authenticateToken
