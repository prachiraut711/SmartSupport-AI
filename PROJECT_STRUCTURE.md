# SmartSupport AI — Project Structure & Directory Blueprint

This document defines the planned folder and file structure for the **SmartSupport AI** application. It serves as the official organizational blueprint, ensuring consistent development, clear separation of concerns, and beginner-friendly navigation across both the frontend and backend.

This structure directly aligns with the architecture outlined in [PROJECT_PLAN.md](file:///D:/prachi/Antigravity-Projects/SmartSupport%20AI/PROJECT_PLAN.md).

---

## 1. High-Level Project Tree

The project uses a clean multi-package layout where the frontend and backend live in dedicated root directories, accompanied by top-level configuration, CI/CD workflows, and documentation:

```
SmartSupport AI/
├── .github/                       # GitHub Actions CI/CD automation
│   └── workflows/
├── frontend/                      # React, Vite, TypeScript & Tailwind client
│   ├── public/
│   └── src/
├── backend/                       # Node.js, Express, TypeScript & Prisma API
│   ├── prisma/
│   └── src/
├── PROJECT_PLAN.md                # System design & architecture document
├── PROJECT_STRUCTURE.md           # This structural reference document
├── README.md                      # Project setup & quickstart instructions
├── .gitignore                     # Global git ignore configuration
└── docker-compose.yml             # Local multi-container orchestration (future)
```

---

## 2. Root-Level Files & Folders

| Path | Purpose & Explanation |
| :--- | :--- |
| **`.github/workflows/`** | Stores continuous integration and continuous deployment pipelines (e.g., testing on PRs, automated deployment). |
| **`frontend/`** | Contains the entire client-side Single Page Application (SPA). |
| **`backend/`** | Contains the Express REST API, Prisma ORM configuration, and business logic. |
| **`PROJECT_PLAN.md`** | High-level system architecture, goals, tech stack, and phase breakdown. |
| **`PROJECT_STRUCTURE.md`**| Detailed folder directory layout, file mapping, and responsibility guide. |
| **`README.md`** | Onboarding documentation, prerequisites, setup instructions, and scripts. |
| **`.gitignore`** | Specifies files and directories Git must ignore (`node_modules/`, `.env`, build artifacts, etc.). |
| **`docker-compose.yml`** | (Future) Defines containers for running PostgreSQL, backend, and frontend locally with a single command. |

---

## 3. Frontend Planned Structure (`frontend/`)

The frontend is built with **React**, **TypeScript**, **Vite**, **Tailwind CSS**, and **shadcn/ui**. It prioritizes component modularity and type-safe server state management with **TanStack Query**.

### 3.1 Directory Tree
```
frontend/
├── public/                        # Static public assets (favicon, logos, brand icons)
├── src/
│   ├── components/                # Reusable UI building blocks
│   │   ├── common/                # Generic elements (Navbar, Footer, LoadingSpinner, EmptyState)
│   │   ├── ui/                    # shadcn/ui primitives (Button, Dialog, DropdownMenu, Badge, Input, Table)
│   │   ├── tickets/               # Ticket-specific components (TicketCard, TicketFilter, ReplyBox, StatusBadge)
│   │   ├── ai/                    # AI visual components (AIAnalysisCard, SuggestedReplyEditor, SentimentIndicator)
│   │   └── dashboard/             # Agent metric cards, charts using Recharts
│   ├── pages/                     # Full-page views mapped to React Router routes
│   │   ├── auth/                  # LoginPage.tsx, RegisterPage.tsx
│   │   ├── customer/              # CustomerDashboard.tsx, CreateTicketPage.tsx, CustomerTicketDetailPage.tsx
│   │   └── agent/                 # AgentDashboard.tsx, AgentQueuePage.tsx, AgentTicketDetailPage.tsx
│   ├── layouts/                   # Structural page wrappers
│   │   ├── AuthLayout.tsx         # Centered card layout for login and registration
│   │   ├── CustomerLayout.tsx     # Customer navigation bar, container, and footer
│   │   └── AgentLayout.tsx        # Agent workspace layout with sidebar, header, and quick stats
│   ├── services/                  # HTTP client functions communicating with the Express API
│   │   ├── api.ts                 # Axios or Fetch client instance with JWT Bearer interceptor
│   │   ├── authService.ts         # login(), register(), getCurrentUser()
│   │   ├── ticketService.ts       # getTickets(), getTicketById(), createTicket(), updateStatus()
│   │   └── aiService.ts           # getTicketAnalysis(), regenerateSuggestedReply()
│   ├── hooks/                     # Custom reusable React hooks
│   │   ├── useAuth.ts             # Provides current user, token state, login/logout handlers
│   │   ├── useTickets.ts          # TanStack Query hooks for ticket fetching, mutations, and caching
│   │   └── useDebounce.ts         # Debounces search inputs for the ticket filter bar
│   ├── types/                     # Shared TypeScript interfaces & types
│   │   ├── auth.types.ts          # User, AuthResponse, LoginCredentials, RegisterData
│   │   ├── ticket.types.ts        # Ticket, Message, TicketStatus, TicketPriority, TicketCategory
│   │   ├── ai.types.ts            # AIAnalysis, SentimentType
│   │   └── dashboard.types.ts     # MetricSummary, ChartDataPoint
│   ├── utils/                     # Utility helper functions
│   │   ├── cn.ts                  # ClassName helper combining clsx and tailwind-merge (for shadcn)
│   │   ├── formatDate.ts          # Human-friendly timestamp formatting
│   │   └── constants.ts           # App-wide constants (status colors, category labels)
│   ├── tests/                     # Frontend unit and component tests (Vitest + Testing Library)
│   │   ├── components/            # Tests for individual UI elements
│   │   └── pages/                 # Tests for page flows and authentication guards
│   ├── App.tsx                    # Root component with React Router route definitions & Providers
│   └── main.tsx                   # React DOM mount point with QueryClientProvider & AuthProvider
├── .env.example                   # Sample environment file (e.g. VITE_API_URL)
├── Dockerfile                     # (Future) Multi-stage Docker build for production
├── index.html                     # Single-page HTML entry point
├── package.json                   # Frontend dependencies and npm scripts
├── tailwind.config.js             # Tailwind CSS design system configuration
├── tsconfig.json                  # TypeScript compiler settings
└── vite.config.ts                 # Vite bundler, proxy, and test settings
```

### 3.2 Key Folder Explanations (Frontend)
- **`components/ui/`**: Houses shadcn/ui components. Rather than an uneditable third-party package, these are directly accessible in code, making styling adjustments seamless.
- **`components/ai/`**: Isolates all UI elements related to the AI workflow—including the sentiment badge, the AI issue summary card, and the editable draft reply workbench.
- **`layouts/`**: Separates view chrome (navigation bars, sidebars) from page content so that the customer portal and agent workspace can have completely distinct layouts without code duplication.
- **`services/`**: Centralizes API communication. Components do not make raw `fetch` calls; they call typed service methods that automatically attach JWT tokens.
- **`hooks/`**: Encapsulates stateful logic and data-fetching hooks (powered by TanStack Query) so components stay lean and focus purely on rendering.

---

## 4. Backend Planned Structure (`backend/`)

The backend is built with **Node.js**, **Express.js**, **TypeScript**, and **Prisma ORM**. It adheres to a strict layered pattern:  
`Route → Controller → Service → Database (Prisma) / External AI (Gemini)`.

### 4.1 Directory Tree
```
backend/
├── prisma/                        # Database schema, migrations, and seeds
│   ├── schema.prisma              # Complete data model, enums, and relations
│   ├── migrations/                # Version-controlled SQL migration files
│   └── seed.ts                    # (Optional) Seed script to generate test users and sample tickets
├── src/
│   ├── controllers/               # Handles HTTP requests, extracts parameters, sends status codes
│   │   ├── auth.controller.ts     # Handlers for /register, /login, /me
│   │   ├── ticket.controller.ts   # Handlers for ticket CRUD, filtering, assignment, status update
│   │   ├── message.controller.ts  # Handlers for sending customer replies and internal notes
│   │   ├── ai.controller.ts       # Handlers for retrieving AI analysis and triggering re-analysis
│   │   └── dashboard.controller.ts# Handlers for agent queue analytics and status counts
│   ├── routes/                    # Express Router definitions mapping URLs to controllers
│   │   ├── auth.routes.ts         # Routes: /api/auth/*
│   │   ├── ticket.routes.ts       # Routes: /api/tickets/*
│   │   ├── message.routes.ts      # Nested or direct routes for ticket messages: /api/tickets/:id/messages
│   │   ├── ai.routes.ts           # Routes: /api/ai/* (Agent-only)
│   │   ├── dashboard.routes.ts    # Routes: /api/dashboard/* (Agent-only)
│   │   └── index.ts               # Master router aggregating all sub-routes under /api
│   ├── services/                  # Core business logic and external integrations
│   │   ├── auth.service.ts        # Password hashing, JWT token generation, credential verification
│   │   ├── ticket.service.ts      # Ticket lifecycle management, role-based ticket retrieval
│   │   ├── message.service.ts     # Appending messages, enforcing internal note privacy rules
│   │   ├── ai.service.ts          # Google Gemini API integration, prompt generation, JSON response parsing
│   │   └── dashboard.service.ts   # Aggregation queries for counts, sentiment metrics, resolution times
│   ├── middleware/                # Express middleware functions
│   │   ├── auth.middleware.ts     # Verifies JWT Bearer token and injects user into req.user
│   │   ├── role.middleware.ts     # Enforces role access (requireAgent, requireCustomer)
│   │   ├── validate.middleware.ts # Validates request bodies against schemas (e.g. title length, valid enum)
│   │   └── error.middleware.ts    # Centralized global error handling and formatting
│   ├── utils/                     # Utility and helper functions
│   │   ├── jwt.ts                 # Sign and verify JWT utility
│   │   ├── password.ts            # bcrypt hash and compare helpers
│   │   ├── geminiPrompt.ts        # System instruction and prompt template for ticket analysis
│   │   └── logger.ts              # Formatted console or application logger
│   ├── types/                     # Backend TypeScript interfaces and extensions
│   │   ├── express.d.ts           # Extends Express.Request to include `user` payload from JWT
│   │   ├── auth.types.ts          # Token payload and credentials interfaces
│   │   └── ai.types.ts            # Gemini structured response schema definitions
│   └── server.ts                  # App initialization, middleware registration, DB connection, and listen
├── tests/                         # Backend tests (Vitest + Supertest)
│   ├── integration/               # API route integration tests (auth, ticket lifecycle)
│   └── unit/                      # Unit tests for services (ai.service, password helpers)
├── .env.example                   # Sample environment file (DATABASE_URL, JWT_SECRET, GEMINI_API_KEY, PORT)
├── Dockerfile                     # (Future) Multi-stage Docker build for backend API
├── package.json                   # Dependencies and npm scripts
├── tsconfig.json                  # TypeScript compiler settings
└── vitest.config.ts               # Vitest test runner configuration
```

### 4.2 Key Folder Explanations (Backend)
- **`prisma/`**: Contains the single source of truth for the database schema (`schema.prisma`) and automatically generated SQL migration scripts.
- **`routes/` vs `controllers/`**: 
  - `routes/` simply map the HTTP verb and URI (e.g., `POST /api/tickets`) to a controller function, while applying appropriate middlewares (`authenticateToken`, `requireAgent`).
  - `controllers/` receive the incoming request, validate parameter existence, call the corresponding service, and return an HTTP status code with JSON data.
- **`services/`**: Contains **zero** HTTP code (no `req` or `res`). This makes all business logic easy to test in isolation with Vitest.
- **`services/ai.service.ts`**: The only file in the entire project that interacts with the Google Gemini API. It handles prompt building, calling the Gemini SDK, error handling/fallbacks, and returning structured data.
- **`middleware/`**: Intercepts requests before controllers run. For example, `role.middleware.ts` checks if a customer is attempting to view agent-only queues or AI data and returns an immediate `403 Forbidden`.

---

## 5. Feature-to-File Mapping Reference

This lookup table demonstrates exactly where each required functional requirement lives across the codebase:

| Feature / Responsibility | Backend Location | Frontend Location |
| :--- | :--- | :--- |
| **Prisma Schema & Migrations** | `backend/prisma/schema.prisma`<br>`backend/prisma/migrations/` | *N/A (database layer)* |
| **Authentication (JWT & bcrypt)** | `backend/src/routes/auth.routes.ts`<br>`backend/src/controllers/auth.controller.ts`<br>`backend/src/services/auth.service.ts`<br>`backend/src/middleware/auth.middleware.ts`<br>`backend/src/utils/jwt.ts`<br>`backend/src/utils/password.ts` | `frontend/src/pages/auth/`<br>`frontend/src/layouts/AuthLayout.tsx`<br>`frontend/src/services/authService.ts`<br>`frontend/src/hooks/useAuth.ts`<br>`frontend/src/types/auth.types.ts` |
| **Role Authorization (`CUSTOMER` vs `AGENT`)** | `backend/src/middleware/role.middleware.ts` | `frontend/src/App.tsx` (Protected routes)<br>`frontend/src/layouts/CustomerLayout.tsx`<br>`frontend/src/layouts/AgentLayout.tsx` |
| **Ticket Management (CRUD, Status, Priority)** | `backend/src/routes/ticket.routes.ts`<br>`backend/src/controllers/ticket.controller.ts`<br>`backend/src/services/ticket.service.ts` | `frontend/src/pages/customer/`<br>`frontend/src/pages/agent/`<br>`frontend/src/components/tickets/`<br>`frontend/src/services/ticketService.ts`<br>`frontend/src/hooks/useTickets.ts` |
| **Conversation & Messages** | `backend/src/routes/message.routes.ts`<br>`backend/src/controllers/message.controller.ts`<br>`backend/src/services/message.service.ts` | `frontend/src/components/tickets/ReplyBox.tsx`<br>`frontend/src/components/tickets/MessageList.tsx` |
| **Internal Notes (Agent only)** | `backend/src/services/message.service.ts` *(filters out `isInternalNote: true` for customers)* | `frontend/src/components/tickets/ReplyBox.tsx` *(toggle internal note)* |
| **Google Gemini AI Integration** | `backend/src/routes/ai.routes.ts`<br>`backend/src/controllers/ai.controller.ts`<br>`backend/src/services/ai.service.ts`<br>`backend/src/utils/geminiPrompt.ts`<br>`backend/src/types/ai.types.ts` | `frontend/src/components/ai/AIAnalysisCard.tsx`<br>`frontend/src/components/ai/SuggestedReplyEditor.tsx`<br>`frontend/src/components/ai/SentimentIndicator.tsx`<br>`frontend/src/services/aiService.ts`<br>`frontend/src/types/ai.types.ts` |
| **Dashboard & Analytics** | `backend/src/routes/dashboard.routes.ts`<br>`backend/src/controllers/dashboard.controller.ts`<br>`backend/src/services/dashboard.service.ts` | `frontend/src/pages/agent/AgentDashboard.tsx`<br>`frontend/src/components/dashboard/MetricCard.tsx`<br>`frontend/src/components/dashboard/SentimentChart.tsx` |
| **Input Validation** | `backend/src/middleware/validate.middleware.ts` | `frontend/src/pages/customer/CreateTicketPage.tsx` *(Form validation)* |
| **Error Handling** | `backend/src/middleware/error.middleware.ts` | `frontend/src/services/api.ts` *(Axios response interceptor)*<br>`frontend/src/components/common/ErrorBoundary.tsx` |
| **Automated Testing** | `backend/tests/integration/`<br>`backend/tests/unit/`<br>`backend/vitest.config.ts` | `frontend/src/tests/components/`<br>`frontend/src/tests/pages/`<br>`frontend/vite.config.ts` |
| **Docker Configuration** | `backend/Dockerfile` | `frontend/Dockerfile`<br>`docker-compose.yml` *(at project root)* |
| **GitHub Actions CI/CD** | `.github/workflows/ci.yml` *(runs backend tests & frontend build on pull request)*<br>`.github/workflows/deploy.yml` *(optional deployment trigger)* | `.github/workflows/ci.yml` |
| **Environment Variable Examples** | `backend/.env.example`<br>*(DATABASE_URL, JWT_SECRET, GEMINI_API_KEY, PORT)* | `frontend/.env.example`<br>*(VITE_API_URL)* |

---

## 6. How Data Flows Through This Structure

To visualize why these folders exist, here is what happens when a Customer submits a new support ticket:

```
1. USER CLICKS SUBMIT
   └─ frontend/src/pages/customer/CreateTicketPage.tsx
      └─ Form collects title, description, category.

2. FRONTEND SERVICE CALL
   └─ frontend/src/services/ticketService.ts
      └─ Calls api.post('/tickets', data) with JWT attached from useAuth().

3. BACKEND ROUTE & MIDDLEWARE
   └─ backend/src/routes/ticket.routes.ts
      └─ auth.middleware.ts verifies token.
      └─ validate.middleware.ts checks required fields.

4. CONTROLLER DISPATCH
   └─ backend/src/controllers/ticket.controller.ts
      └─ Extracts req.body and req.user, forwards to ticket.service.ts.

5. BUSINESS LOGIC & DATABASE WRITE
   └─ backend/src/services/ticket.service.ts
      └─ Creates Ticket in PostgreSQL via Prisma.
      └─ Calls backend/src/services/ai.service.ts asynchronously.

6. AI ASSISTANCE TRIGGER
   └─ backend/src/services/ai.service.ts
      └─ Builds prompt with geminiPrompt.ts.
      └─ Calls Google Gemini API securely using process.env.GEMINI_API_KEY.
      └─ Parses structured JSON (summary, sentiment, suggestedReply).
      └─ Saves AIAnalysis record in PostgreSQL via Prisma.

7. AGENT REVIEWS & REPLIES
   └─ frontend/src/pages/agent/AgentTicketDetailPage.tsx
      └─ Fetches ticket and AIAnalysis via frontend/src/services/ticketService.ts.
      └─ Displays AI summary and draft in SuggestedReplyEditor.tsx.
      └─ Agent edits draft and posts reply to /api/tickets/:id/messages.
```

---

## 7. Consistency & Architectural Rules

1. **No Frontend Secrets**: The `GEMINI_API_KEY` never exists anywhere in `frontend/`. It only resides in `backend/.env`.
2. **Two Roles Only**: Models and role-checking middlewares strictly enforce `CUSTOMER` and `AGENT`. No extraneous roles (Admin, Manager, Supervisor) are introduced.
3. **Pure Services**: Controllers never directly access Prisma; they always delegate to services in `backend/src/services/`.
4. **Human-in-the-Loop**: The AI service writes to the `AIAnalysis` table; it does not post to the `Message` table directly. Only an agent's verified submission creates customer-visible replies.
5. **No Premature Implementation**: Directory structures and files are created according to phased development, keeping git history clean and understandable.
