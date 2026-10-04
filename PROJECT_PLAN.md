# SmartSupport AI — Project Planning & Architecture Document

Welcome to the project planning document for **SmartSupport AI**. This document outlines the architectural blueprint, technological choices, data design, security standards, and phase-by-phase roadmap for building a modern, industry-inspired, AI-powered customer support and ticket management SaaS application.

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Project Goals](#2-project-goals)
3. [Main Users & Permissions](#3-main-users--permissions)
4. [High-Level Architecture](#4-high-level-architecture)
5. [Frontend Architecture](#5-frontend-architecture)
6. [Backend Architecture](#6-backend-architecture)
7. [Database Entities & Relationships](#7-database-entities--relationships)
8. [AI Integration Architecture](#8-ai-integration-architecture)
9. [Security Principles](#9-security-principles)
10. [Development Phases](#10-development-phases)
11. [Git Workflow](#11-git-workflow)
12. [Docker & Deployment Direction](#12-docker--deployment-direction)

---

## 1. Project Overview

**SmartSupport AI** is a multi-tenant-ready, full-stack customer support ticketing SaaS platform. It bridges the gap between everyday customer inquiries and efficient support operations by introducing an **assistive AI layer** powered by Google Gemini.

In traditional customer support systems, agents spend significant time manually reading long tickets, categorizing issues, assessing urgency, and drafting repetitive responses. SmartSupport AI streamlines this workflow:
- When a customer submits a ticket, a background backend service sends the issue to Google's Gemini API for analysis.
- The AI extracts the ticket's category, priority, sentiment, and summary, and generates a polite, contextual draft reply.
- The support agent reviews this analysis, modifies the draft reply as desired, and sends it out.
- Customers receive timely, high-quality responses while agents handle significantly higher ticket volumes with less burnout.

---

## 2. Project Goals

1. **Human-in-the-Loop AI**: Empower support agents with AI suggestions without letting an autonomous bot send uncontrolled responses directly to customers.
2. **Clean & Maintainable Architecture**: Follow clear separation of concerns on both frontend and backend to facilitate easy onboarding and scalability.
3. **Enterprise-Grade Security**: Ensure zero leakage of sensitive API keys (especially the Gemini API key), secure password storage, and strict role-based access control.
4. **Developer-Friendly Experience**: Use modern, type-safe tooling (TypeScript throughout, Vite, Prisma, React Query) to minimize runtime bugs.
5. **Production Readiness**: Provide a robust path to containerization (Docker) and cloud deployment (Vercel, Render/Railway, Neon/Supabase).

---

## 3. Main Users & Permissions

SmartSupport AI intentionally limits user management to **two strictly defined roles** to maintain clean boundaries:

```
                  +---------------------------+
                  |         User Roles        |
                  +-------------+-------------+
                                |
               +----------------+----------------+
               |                                 |
         +-----v-----+                     +-----v-----+
         |  CUSTOMER |                     |   AGENT   |
         +-----------+                     +-----------+
```

### 3.1 Customer
Customers are end-users seeking help with products, subscriptions, or technical issues.

**Permissions & Actions:**
- **Account**: Register a new account, log in, manage personal profile.
- **Ticket Creation**: Submit new support tickets with a title, description, and initial category.
- **Ticket Management**: View a list of their own submitted tickets with live status indicators.
- **Ticket Conversation**: View ticket details, read responses from agents, post follow-up replies, and inspect ticket history.
- *Restrictions*: Cannot view tickets belonging to other customers, cannot view internal agent notes, cannot view raw AI analysis data, and cannot change priority or assignment.

### 3.2 Support Agent
Agents are team members responsible for resolving customer inquiries and maintaining customer satisfaction.

**Permissions & Actions:**
- **Account**: Log in with agent credentials.
- **Queue Management**: View all tickets across the platform, search by keywords, filter by status, priority, or category.
- **Ticket Triage**: Assign/reassign tickets to themselves or other agents, change ticket statuses, and adjust priorities.
- **AI Workbench**: View AI-generated summaries, sentiment metrics, suggested categories/priorities, and AI-drafted replies.
- **Communication**: Edit and approve AI-generated draft replies before sending them to the customer, write custom replies, and add private **internal notes** (hidden from the customer).
- **Ticket Resolution**: Mark tickets as resolved or closed.
- **Analytics & Dashboard**: View support metrics such as open ticket counts, average response times, and sentiment distribution charts.

---

## 4. High-Level Architecture

The system follows a classic decoupled client-server architecture with an external AI service and a relational database:

```mermaid
flowchart TD
    subgraph Client["Frontend Client (Browser)"]
        UI["React + Vite + Tailwind CSS + shadcn/ui"]
        State["TanStack Query (Cache & State)"]
        Router["React Router"]
    end

    subgraph Server["Backend API (Node.js & Express)"]
        API["Express REST API (TypeScript)"]
        Auth["JWT & bcrypt Authentication Middleware"]
        Controllers["Controllers & Routes"]
        Services["Business Services Layer"]
        AIService["Gemini AI Service Layer"]
    end

    subgraph Data["Data & External Services"]
        DB[("PostgreSQL Database via Prisma ORM")]
        Gemini["Google Gemini API"]
    end

    UI -->|User Interactions| Router
    Router --> State
    State -->|HTTP Requests with JWT Bearer Token| API
    API --> Auth
    Auth --> Controllers
    Controllers --> Services
    Services --> DB
    Services --> AIService
    AIService -->|Secure Server-to-Server HTTPS| Gemini
```

### Flow of Data:
1. **User Request**: The user interacts with the React frontend.
2. **REST API Call**: TanStack Query sends an HTTP request with a JWT Bearer token to the Express backend.
3. **Authentication & Authorization**: Express middleware verifies the token and validates user role permissions.
4. **Controller & Service**: The controller delegates logic to the dedicated service module.
5. **Database Interaction**: The service communicates with PostgreSQL via Prisma ORM.
6. **AI Processing**: When an analysis or draft reply is needed, the backend AI service securely connects to the Google Gemini API using an environment-stored API key.
7. **Safe Response**: Data returns to the frontend without ever exposing internal database queries or third-party API credentials.

---

## 5. Frontend Architecture

### 5.1 Tech Stack
- **Framework & Tooling**: [React 18+](https://react.dev/) with [Vite](https://vitejs.dev/) for high-speed builds and HMR.
- **Language**: [TypeScript](https://www.typescriptlang.org/) for complete type safety across components and API responses.
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) for rapid utility-first UI styling.
- **UI Component Library**: [shadcn/ui](https://ui.shadcn.com/) (Radix UI primitives under the hood) for accessible, customizable, and professional components (modals, dropdowns, tables, badges, toasts).
- **Routing**: [React Router v6](https://reactrouter.com/) for client-side routing, nested layouts, and route protection guards.
- **Server State & Data Fetching**: [TanStack Query (React Query)](https://tanstack.com/query/latest) for automatic caching, refetching, background synchronization, and loading/error states.
- **Data Visualization**: [Recharts](https://recharts.org/) for rendering metrics, ticket volume trends, and sentiment distribution in the agent dashboard.

### 5.2 Folder Structure
```
frontend/
├── public/
├── src/
│   ├── components/            # Reusable UI elements
│   │   ├── common/            # Buttons, Badges, Loaders, Inputs
│   │   ├── tickets/           # TicketCard, TicketList, TicketFilter, ReplyBox
│   │   ├── ai/                # AIAnalysisCard, SuggestedReplyEditor, SentimentBadge
│   │   └── ui/                # shadcn/ui components (dialog, dropdown, table, etc.)
│   ├── pages/                 # Full view pages mapped to routes
│   │   ├── auth/              # Login, Register
│   │   ├── customer/          # CustomerDashboard, CreateTicket, CustomerTicketDetail
│   │   └── agent/             # AgentDashboard, AgentTicketQueue, AgentTicketDetail, Analytics
│   ├── layouts/               # Page wrapper layouts
│   │   ├── AuthLayout.tsx     # Clean centering layout for login/register
│   │   ├── CustomerLayout.tsx # Customer navigation bar and container
│   │   └── AgentLayout.tsx    # Agent sidebar, topbar, and workspace
│   ├── services/              # API clients and HTTP wrappers (Axios/Fetch)
│   │   ├── api.ts             # Base API instance with JWT interceptor
│   │   ├── authService.ts     # Login, register, profile
│   │   └── ticketService.ts   # Ticket CRUD, reply, assign, AI trigger
│   ├── hooks/                 # Custom React hooks
│   │   ├── useAuth.ts         # User session and authentication state
│   │   ├── useTickets.ts      # TanStack Query hooks for tickets
│   │   └── useDebounce.ts     # Input debounce utility for ticket search
│   ├── types/                 # TypeScript interfaces and type definitions
│   │   ├── auth.types.ts      # User, AuthResponse, Credentials
│   │   ├── ticket.types.ts    # Ticket, Message, Status, Priority, Category
│   │   └── ai.types.ts        # AIAnalysis, Sentiment
│   ├── utils/                 # Formatting, date helpers, classnames merger
│   │   ├── cn.ts              # Tailwind class merge helper
│   │   └── formatDate.ts      # Friendly date formatting (e.g. date-fns)
│   ├── App.tsx                # App entry point, Router setup, QueryClient provider
│   └── main.tsx               # DOM mount point
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

### 5.3 Key Design Patterns on the Frontend
- **Route Guards**: `ProtectedRoute` wrapper component redirects unauthenticated users to `/login` and verifies role privileges (e.g., preventing customers from loading agent routes).
- **Optimistic Updates**: Using TanStack Query to immediately reflect newly posted ticket replies while network requests complete in the background.
- **AI Suggested Reply Review Flow**: The suggested reply is rendered into an interactive editable textarea, accompanied by "Insert AI Reply", "Regenerate", and "Discard" actions.

---

## 6. Backend Architecture

### 6.1 Tech Stack
- **Runtime**: [Node.js](https://nodejs.org/) (LTS version).
- **Framework**: [Express.js](https://expressjs.com/) for a lightweight, flexible REST API framework.
- **Language**: [TypeScript](https://www.typescriptlang.org/) for strict request/response validation and maintainability.
- **Database Access**: [Prisma ORM](https://www.prisma.io/) for type-safe database queries, schema modeling, and migrations.
- **Authentication**: `jsonwebtoken` (JWT) for stateless token verification and `bcrypt` for secure password hashing.
- **Testing**: `Vitest` and `Supertest` for unit and integration testing of API routes and business logic.

### 6.2 Architectural Pattern: Layered Architecture
To keep the codebase maintainable, testable, and beginner-friendly, the backend strictly implements the **Route → Controller → Service → Data** pattern:

```
[ Incoming HTTP Request ]
           │
           ▼
┌─────────────────────────┐
│         Routes          │  Defines API endpoints, HTTP methods, and attaches middleware.
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│       Controllers       │  Extracts request params/body, coordinates responses, handles status codes.
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│        Services         │  Contains all core business logic, rule evaluations, and AI orchestrations.
└──────────┬──────────────┘
           │
     ┌─────┴────────────────┐
     ▼                      ▼
┌──────────────┐     ┌──────────────┐
│  Prisma ORM  │     │  Gemini API  │  Direct data persistence or external AI generation.
│ (PostgreSQL) │     │ (External)   │
└──────────────┘     └──────────────┘
```

### 6.3 Folder Structure
```
backend/
├── prisma/
│   ├── schema.prisma          # Database schema models, enums, relationships
│   └── migrations/            # SQL migration history
├── src/
│   ├── controllers/           # HTTP request handlers
│   │   ├── auth.controller.ts
│   │   ├── ticket.controller.ts
│   │   └── ai.controller.ts
│   ├── routes/                # Express router definitions
│   │   ├── auth.routes.ts
│   │   ├── ticket.routes.ts
│   │   ├── ai.routes.ts
│   │   └── index.ts
│   ├── services/              # Pure business logic layer
│   │   ├── auth.service.ts
│   │   ├── ticket.service.ts
│   │   ├── ai.service.ts
│   │   └── email.service.ts   # Optional mock/notification service
│   ├── middleware/            # Custom Express middleware
│   │   ├── auth.middleware.ts # JWT verification & role authorization (requireAgent)
│   │   ├── error.middleware.ts# Centralized error handler
│   │   └── validate.middleware.ts # Request payload validator
│   ├── utils/                 # Helper utilities
│   │   ├── jwt.ts             # Token signing & verification
│   │   ├── password.ts        # bcrypt hash & compare helpers
│   │   └── logger.ts          # Structured logging
│   ├── types/                 # Custom TypeScript definitions & Express extensions
│   │   ├── express.d.ts       # Extends Express.Request with authenticated user
│   │   └── index.ts
│   └── server.ts              # Express application setup, middleware mounting, and listener
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 7. Database Entities & Relationships

### 7.1 Database & ORM
- **Engine**: PostgreSQL
- **ORM**: Prisma ORM

### 7.2 Enums
```prisma
enum Role {
  CUSTOMER
  AGENT
}

enum TicketStatus {
  OPEN
  IN_PROGRESS
  WAITING_FOR_CUSTOMER
  RESOLVED
  CLOSED
}

enum TicketPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum TicketCategory {
  BILLING
  TECHNICAL
  ACCOUNT
  SUBSCRIPTION
  REFUND
  OTHER
}
```

### 7.3 Entities & Attributes

1. **User**
   - `id`: String (UUID or CUID, Primary Key)
   - `email`: String (Unique, Indexed)
   - `passwordHash`: String
   - `name`: String
   - `role`: `Role` (Default: `CUSTOMER`)
   - `createdAt`: DateTime
   - `updatedAt`: DateTime
   - *Relations*:
     - `ticketsCreated`: 1-to-many relationship with `Ticket` (as customer)
     - `ticketsAssigned`: 1-to-many relationship with `Ticket` (as assigned agent)
     - `messages`: 1-to-many relationship with `Message`

2. **Ticket**
   - `id`: String (UUID or CUID, Primary Key)
   - `title`: String
   - `description`: String (Initial customer inquiry)
   - `status`: `TicketStatus` (Default: `OPEN`)
   - `priority`: `TicketPriority` (Default: `MEDIUM`)
   - `category`: `TicketCategory` (Default: `OTHER`)
   - `customerId`: String (Foreign Key referencing `User.id`)
   - `assignedAgentId`: String (Nullable, Foreign Key referencing `User.id`)
   - `createdAt`: DateTime
   - `updatedAt`: DateTime
   - *Relations*:
     - `customer`: Many-to-1 relationship with `User`
     - `assignedAgent`: Many-to-1 relationship with `User` (Optional)
     - `messages`: 1-to-many relationship with `Message`
     - `aiAnalysis`: 1-to-1 relationship with `AIAnalysis`

3. **Message**
   - `id`: String (UUID or CUID, Primary Key)
   - `ticketId`: String (Foreign Key referencing `Ticket.id`)
   - `senderId`: String (Foreign Key referencing `User.id`)
   - `content`: String
   - `isInternalNote`: Boolean (Default: `false`; if true, visible only to agents)
   - `createdAt`: DateTime
   - *Relations*:
     - `ticket`: Many-to-1 relationship with `Ticket`
     - `sender`: Many-to-1 relationship with `User`

4. **AIAnalysis**
   - `id`: String (UUID or CUID, Primary Key)
   - `ticketId`: String (Unique, Foreign Key referencing `Ticket.id`)
   - `suggestedCategory`: `TicketCategory`
   - `suggestedPriority`: `TicketPriority`
   - `sentiment`: String (e.g., "Frustrated", "Neutral", "Positive", "Angry")
   - `summary`: String (Concise summary of customer issue)
   - `suggestedReply`: String (Professional initial response draft for the agent)
   - `createdAt`: DateTime
   - `updatedAt`: DateTime
   - *Relations*:
     - `ticket`: 1-to-1 relationship with `Ticket`

### 7.4 Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    User ||--o{ Ticket : "creates (as customer)"
    User ||--o{ Ticket : "is assigned to (as agent)"
    User ||--o{ Message : "sends"
    Ticket ||--o{ Message : "contains"
    Ticket ||--o| AIAnalysis : "has"

    User {
        string id PK
        string email
        string passwordHash
        string name
        Role role
        datetime createdAt
        datetime updatedAt
    }

    Ticket {
        string id PK
        string title
        string description
        TicketStatus status
        TicketPriority priority
        TicketCategory category
        string customerId FK
        string assignedAgentId FK
        datetime createdAt
        datetime updatedAt
    }

    Message {
        string id PK
        string ticketId FK
        string senderId FK
        string content
        boolean isInternalNote
        datetime createdAt
    }

    AIAnalysis {
        string id PK
        string ticketId FK
        TicketCategory suggestedCategory
        TicketPriority suggestedPriority
        string sentiment
        string summary
        string suggestedReply
        datetime createdAt
        datetime updatedAt
    }
```

---

## 8. AI Integration Architecture

### 8.1 Core Principle: Human-in-the-Loop
The Google Gemini integration acts as an **intelligence amplifier** for support personnel, never as an unmonitored automated responder. 
- **Strict Rule**: The AI service **never** sends an automated message directly to the customer.
- All AI suggestions (summaries, classifications, drafts) are displayed in the **Agent Workbench**.
- The agent has full control to accept, edit, tweak, or completely replace the suggested response before posting it.

### 8.2 Architectural Isolation of the Gemini API
- **Zero Frontend Footprint**: The frontend has no knowledge of the Google Gemini SDK or the API key.
- **Server-Side Exclusivity**: The Gemini API key (`GEMINI_API_KEY`) is stored strictly in server-side environment variables and loaded exclusively in `backend/src/services/ai.service.ts`.
- **Protected Endpoints**: The endpoints that trigger AI re-analysis or fetch AI analysis are protected by authentication and restricted to users with the `AGENT` role.

### 8.3 AI Service Pipeline
```mermaid
sequenceDiagram
    autonumber
    actor Customer
    actor Agent
    participant Backend as Express Backend
    participant Gemini as Google Gemini API
    participant DB as PostgreSQL (Prisma)

    Customer->>Backend: POST /api/tickets (Submit Ticket)
    Backend->>DB: Save Ticket (Status: OPEN)
    Backend->>Gemini: Request Analysis (Title & Description)
    Note over Backend,Gemini: Structured JSON Prompt: Category, Priority, Sentiment, Summary, Draft Reply
    Gemini-->>Backend: Returns Structured JSON
    Backend->>DB: Save AIAnalysis Record
    Backend-->>Customer: Ticket Created Confirmation

    Note over Agent,Backend: Later, Agent reviews the queue
    Agent->>Backend: GET /api/tickets/:id (with AI analysis)
    Backend-->>Agent: Ticket Details + AI Summary + Suggested Reply
    Agent->>Agent: Review, personalize, or edit draft reply
    Agent->>Backend: POST /api/tickets/:id/messages (Approve & Send Reply)
    Backend->>DB: Save Message
    Backend-->>Agent: Reply Sent Successfully
```

### 8.4 Expected Structured Output from Gemini
The backend requests a strict JSON schema from Gemini:
```json
{
  "suggestedCategory": "BILLING",
  "suggestedPriority": "HIGH",
  "sentiment": "Frustrated",
  "summary": "Customer was charged twice for their monthly subscription renewal.",
  "suggestedReply": "Hello [Customer Name],\n\nThank you for reaching out. We apologize for the duplicate charge on your subscription renewal. We have located the transaction and initiated an immediate refund for the secondary charge. Please allow 3-5 business days for it to reflect on your statement.\n\nBest regards,\nSupport Team"
}
```

---

## 9. Security Principles

1. **Authentication (JWT & bcrypt)**:
   - Passwords hashed using `bcrypt` with a minimum salt work factor of 10.
   - Authentication tokens issued as stateless JSON Web Tokens (JWT) signed with a secret (`JWT_SECRET`) and a limited lifespan (e.g., 24 hours).
2. **Strict Role-Based Authorization (RBAC)**:
   - Dedicated middleware `authenticateToken` validates the JWT.
   - Middleware `requireRole('AGENT')` blocks customers from accessing agent queues, internal notes, analytics, and AI services.
   - Ownership validation: Customers can only fetch or append messages to tickets where `ticket.customerId === req.user.id`.
3. **Internal Note Privacy**:
   - Messages flagged with `isInternalNote: true` are stripped out of API responses sent to customers.
4. **Environment Variables & Secrets Management**:
   - `GEMINI_API_KEY`, `DATABASE_URL`, and `JWT_SECRET` reside solely in backend `.env` files.
   - `.env` files are explicitly added to `.gitignore`.
5. **Input Validation & Sanitization**:
   - Request bodies validated before entering services to guard against SQL injection (already protected via Prisma parameterization) and Cross-Site Scripting (XSS).
6. **CORS & Rate Limiting**:
   - Backend configured with `cors` allowing only verified frontend origins.
   - Rate limiting applied to `/api/auth/*` and `/api/ai/*` to prevent brute force attacks and API quota exhaustion.

---

## 10. Development Phases

The project will be built progressively over 6 organized phases:

### Phase 1: Planning & Setup
- Finalize requirements and project architecture (completed via this document).
- Initialize Git repository with proper `.gitignore`.
- Set up directory scaffolding for `frontend` and `backend`.

### Phase 2: Database & Backend Foundation
- Initialize Node.js & TypeScript in `backend/`.
- Configure Prisma with PostgreSQL connection.
- Define `schema.prisma` with `User`, `Ticket`, `Message`, and `AIAnalysis` models and enums.
- Run initial Prisma migrations.
- Implement authentication endpoints (`/api/auth/register`, `/api/auth/login`) with `bcrypt` and JWT.
- Build ticket CRUD endpoints with role-based validation.

### Phase 3: AI Service Integration
- Set up `@google/genai` or Google Gemini REST integration in `backend/src/services/ai.service.ts`.
- Formulate and test system instructions and structured prompts for ticket analysis.
- Connect ticket submission events to AI analysis generation and database storage.
- Create agent endpoints to fetch analysis, trigger re-analysis, and request alternative draft replies.

### Phase 4: Frontend Development
- Initialize React + TypeScript project with Vite in `frontend/`.
- Configure Tailwind CSS and install shadcn/ui components.
- Configure React Router with `CustomerLayout` and `AgentLayout`.
- Implement `api.ts` with Axios/Fetch and JWT token injection.
- Build Customer Portal: Register, Login, Create Ticket, My Tickets, Ticket Detail & Reply.
- Build Agent Workspace: Ticket Queue, Advanced Filters, Ticket Detail with AI Workbench, Internal Notes, and Recharts Analytics Dashboard.

### Phase 5: Testing & Quality Assurance
- Backend unit and integration tests using `Vitest` and `Supertest` (Auth, Ticket lifecycle, Role guards, AI parsing fallbacks).
- Frontend component and hook tests with `Vitest` and React Testing Library.
- Edge case validation: Handling Gemini API downtime, invalid JSON responses, and token expiration.

### Phase 6: Containerization & Cloud Deployment
- Create production `Dockerfile` for backend and frontend.
- Configure `docker-compose.yml` for unified local development (PostgreSQL + API + Frontend).
- Setup GitHub Actions CI pipeline for linting, type-checking, and test execution.
- Deploy database to Neon or Supabase, backend to Render/Railway, and frontend to Vercel.

---

## 11. Git Workflow

To maintain a clean and reliable codebase, the project will follow standard Git feature-branch workflows:

### 11.1 Branch Strategy
- `main`: Production-ready code. Always stable and deployable.
- `develop`: Integration branch for tested features.
- `feature/<feature-name>`: Dedicated branches for individual tasks (e.g., `feature/auth-jwt`, `feature/gemini-service`, `feature/agent-ticket-view`).
- `fix/<bug-name>`: Bug fixes for issues discovered during testing.

### 11.2 Commit Convention
Use Conventional Commits for transparent commit logs:
- `feat: add ticket creation endpoint and validation`
- `fix: prevent customers from retrieving internal notes`
- `docs: update setup instructions in README`
- `refactor: extract gemini prompt builder into helper`
- `test: add supertest coverage for role middleware`

### 11.3 Pull Request (PR) Checklist
Before merging any feature branch into `develop` or `main`:
1. All TypeScript types compile without errors (`tsc --noEmit`).
2. Unit and integration tests pass (`npm run test`).
3. Code formatting and linting pass (`npm run lint`).
4. No sensitive secrets or `.env` files are staged.
5. PR includes a clear summary of changes and manual test evidence.

---

## 12. Docker & Deployment Direction

### 12.1 Local Development with Docker Compose
A root `docker-compose.yml` file will be created to allow any developer to spin up the full stack with a single command:
- **db**: Official `postgres:15-alpine` container with persistent data volume.
- **backend**: Node.js container running the Express API with nodemon/tsx hot reloading.
- **frontend**: Node.js container running the Vite dev server with port mapping.

```yaml
# Conceptual docker-compose architecture
services:
  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: smartsupport_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgrespassword
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      DATABASE_URL: "postgresql://postgres:postgrespassword@postgres:5432/smartsupport_db?schema=public"
      JWT_SECRET: "local_dev_secret"
      GEMINI_API_KEY: ${GEMINI_API_KEY}
    depends_on:
      - postgres

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend
```

### 12.2 CI/CD with GitHub Actions
- **Continuous Integration (CI)**: Automatically triggers on pull requests to `main` and `develop`.
  - Runs linting and static analysis.
  - Compiles TypeScript.
  - Executes Vitest test suites.
- **Continuous Deployment (CD)**: Automatically deploys approved changes on merge to `main`.

### 12.3 Production Cloud Deployment Plan
- **Frontend**: Hosted on **Vercel** with automatic global CDN edge caching, preview deployments, and seamless integration with Vite builds.
- **Backend**: Hosted on **Render** or **Railway** as an Express web service container with auto-restart, health-checks, and zero configuration SSL.
- **Database**: Managed cloud PostgreSQL on **Neon** (serverless Postgres with instant branching) or **Supabase**.
- **AI Processing**: Server-to-server outbound requests from the backend directly to the **Google Gemini API**.
