import jwt, { SignOptions, JwtPayload } from "jsonwebtoken"
import { Role } from "@prisma/client"

export interface TokenPayload {
  userId: string
  role: Role
}

/**
 * Retrieves the JWT secret from environment variables safely.
 * Throws a configuration error if missing.
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not configured.")
  }
  return secret
}

/**
 * Retrieves the JWT expiration timeframe from environment variables.
 * Defaults to 7d.
 */
function getJwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN || "7d"
}

/**
 * Signs a new JSON Web Token containing only safe claims (userId, role).
 */
export function signToken(payload: TokenPayload): string {
  const secret = getJwtSecret()
  const expiresIn = getJwtExpiresIn()

  const signOptions: SignOptions = {
    expiresIn: expiresIn as SignOptions["expiresIn"],
  }

  return jwt.sign(payload, secret, signOptions)
}

/**
 * Verifies and decodes a signed JSON Web Token using the configured secret.
 */
export function verifyToken(token: string): TokenPayload & JwtPayload {
  const secret = getJwtSecret()
  return jwt.verify(token, secret) as TokenPayload & JwtPayload
}
