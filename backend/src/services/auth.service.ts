import { Role } from "@prisma/client"
import prisma from "../utils/prisma"
import { hashPassword, comparePassword } from "../utils/password"
import { signToken } from "../utils/jwt"
import { AppError } from "../middleware/error.middleware"
import { RegisterDTO, SafeUser, LoginDTO, LoginResponse } from "../types/auth.types"

/**
 * Registers a new user (CUSTOMER or AGENT).
 *
 * 1. Validates presence of required fields.
 * 2. Normalizes email (trim and lowercase).
 * 3. Validates role (strictly CUSTOMER or AGENT).
 * 4. Checks for duplicate email (returns 409 conflict).
 * 5. Securely hashes the password with bcrypt.
 * 6. Creates the user in the database via Prisma.
 * 7. Returns safe user data (excluding password/hash).
 */
export async function register(data: RegisterDTO): Promise<SafeUser> {
  const { name, email, password, role } = data

  // 1 & 2. Validate required values
  if (
    !name ||
    typeof name !== "string" ||
    !name.trim() ||
    !email ||
    typeof email !== "string" ||
    !email.trim() ||
    !password ||
    typeof password !== "string" ||
    !password.trim() ||
    !role ||
    typeof role !== "string" ||
    !role.trim()
  ) {
    throw new AppError(
      "Missing required fields: name, email, password, and role are required",
      400
    )
  }

  // 3. Normalize and validate email format
  const normalizedEmail = email.trim().toLowerCase()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(normalizedEmail)) {
    throw new AppError("Invalid email address format", 400)
  }

  // 4. Validate role
  if (role !== "CUSTOMER" && role !== "AGENT") {
    throw new AppError(
      "Invalid role: role must be either CUSTOMER or AGENT",
      400
    )
  }

  // 5 & 6. Check for duplicate email
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  if (existingUser) {
    throw new AppError("Email already in use", 409)
  }

  // 7 & 8. Hash password (never store plaintext)
  const hashedPassword = await hashPassword(password)

  // 9. Create user in database
  // 10 & 11. Select only safe fields (never return password or hash)
  const newUser = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: role as Role,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  })

  return newUser
}

/**
 * Authenticates a user and returns a signed JWT and safe user object.
 *
 * 1. Validates presence of email and password.
 * 2. Normalizes email (trim and lowercase).
 * 3. Finds user by email in PostgreSQL via Prisma.
 * 4. Compares password against stored bcrypt hash.
 * 5. Returns generic 401 error if user not found or password incorrect.
 * 6. Generates JWT using configured secret and expiration.
 * 7. Returns JWT token and safe user details (never password or hash).
 */
export async function login(data: LoginDTO): Promise<LoginResponse> {
  const { email, password } = data

  // 1. Validate required fields
  if (
    !email ||
    typeof email !== "string" ||
    !email.trim() ||
    !password ||
    typeof password !== "string" ||
    !password
  ) {
    throw new AppError(
      "Missing required fields: email and password are required",
      400
    )
  }

  // 2. Normalize email
  const normalizedEmail = email.trim().toLowerCase()

  // 3. Find user by email
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  // 4 & 5. Verify user and password with a single generic error
  if (!user) {
    throw new AppError("Invalid email or password", 401)
  }

  const isPasswordValid = await comparePassword(password, user.password)
  if (!isPasswordValid) {
    throw new AppError("Invalid email or password", 401)
  }

  // 6. Generate JWT with safe claims (userId, role)
  const token = signToken({
    userId: user.id,
    role: user.role,
  })

  // 7. Return token and safe user information
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  }
}
