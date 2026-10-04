import { Role } from "@prisma/client"

export interface RegisterDTO {
  name?: unknown
  email?: unknown
  password?: unknown
  role?: unknown
}

export interface LoginDTO {
  email?: unknown
  password?: unknown
}

export interface SafeUser {
  id: string
  name: string
  email: string
  role: Role
  createdAt: Date
}

export interface LoginUser {
  id: string
  name: string
  email: string
  role: Role
}

export interface LoginResponse {
  token: string
  user: LoginUser
}
