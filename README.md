# Cold Plane Network

An internal AWS presales tool for **cloud migration planning**, **infrastructure sizing**, and **cost optimization analysis**. Built on Next.js 16 with AI-powered capabilities via Azure AI Foundry agents.

## Features

### Migration Advisor

- **Azure Resource Import** — Ingest and parse Azure infrastructure exports
- **Intelligent Mapping** — AI-powered Azure-to-AWS service recommendations with confidence scores
- **Visual Network Editor** — Interactive topology visualization and editing with Dagre/XYFlow
- **Data Export** — Export migration plans as CSV or ZIP archives

### Sizing Tool

- **AWS Pricing Calculator Import** — Upload JSON exports from AWS Pricing Calculator
- **AI-Powered Autofill** — Agent automatically looks up and fills service pricing details
- **Excel Report Generation** — Formatted Excel reports with pricing breakdown per service
- **AI Chatbot** — Ask questions about pricing, compare On-Demand vs Reserved, get architecture recommendations
- **File Attachments** — Attach images, JSON, CSV, or PDF files to chat for context-aware analysis

### CFM Analysis (Cloud Financial Management)

- **Multi-Account Management** — Connect multiple AWS accounts via cross-account IAM roles
- **3-Step Connection Wizard** — Account details, analysis scope (regions/services), test connection & confirm
- **Automated Cost Scanning** — AI agent analyzes EC2, RDS, S3, Lambda, CloudWatch, NAT Gateway, CloudTrail, ECS via CFM MCP tools
- **Live Scan Progress** — Real-time SSE stream showing per-service analysis status
- **Dashboard** — Summary cards (total spend, savings potential, priority breakdown), service grid, sortable recommendations table
- **Service Deep Dive** — Per-service recommendations with service-specific columns + AI chat panel for follow-up questions
- **Export Reports** — Excel (multi-sheet with Executive Summary, per-service sheets, Prioritized Action Plan) and PDF (one-page executive summary)
- **Audit Logging** — All CFM actions tracked (account connected, scan started/completed, report exported)

### Platform

- **User Authentication** — Secure login with session management and password hashing
- **Audit Logging** — Comprehensive compliance tracking with data redaction
- **Offline Support** — Client-side storage with IndexedDB

## Tech Stack

- **Framework**: Next.js 16, React 19, TypeScript
- **UI**: TailwindCSS, shadcn/ui, Hugeicons
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: Azure AI Foundry (Responses API with agent_reference, bearer token auth)
- **AWS**: STS AssumeRole for cross-account access, CFM MCP tools for cost analysis
- **Visualization**: Dagre + XYFlow for graph rendering
- **Exports**: ExcelJS for spreadsheets, @react-pdf/renderer for PDF generation
- **Testing**: Vitest with property-based testing (fast-check)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Azure AI Foundry project with a deployed agent
- AWS IAM user with `sts:AssumeRole` permissions (for CFM)

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Set up environment variables:

```bash
cp .env.example .env
```

Configure the following in `.env`:

```bash
# PostgreSQL
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require

# Azure AI Foundry — Agent
AZURE_EXISTING_AGENT_ID="cpn-agent"
AZURE_EXISTING_AIPROJECT_ENDPOINT="https://<resource>.services.ai.azure.com/api/projects/<project>"

# AWS — for CFM cross-account analysis
AWS_ACCESS_KEY_ID=<your-access-key>
AWS_SECRET_ACCESS_KEY=<your-secret-key>
AWS_REGION=ap-southeast-1
```

3. Run database migrations:

```bash
npx drizzle-kit migrate
```

4. Start the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Azure AI Foundry Setup

The Sizing and CFM features require an Azure AI Foundry agent (`cpn-agent`):

1. Create an AI Foundry project in Azure Portal
2. Deploy an agent with CFM MCP tools from [aws-samples/sample-cfm-tips-mcp](https://github.com/aws-samples/sample-cfm-tips-mcp)
3. Authentication uses `DefaultAzureCredential` (falls back to `az login` for local dev)
4. The agent's identity needs the **Azure AI Developer** role on the AI Foundry resource

### AWS IAM Setup (for CFM)

For CFM cost analysis, set up cross-account access:

1. In the **target AWS account**, create an IAM role (e.g., `cfm-analysis-agent`) with:
   - `ReadOnlyAccess` and `ComputeOptimizerReadOnlyAccess` policies
   - Trust policy allowing your CPN IAM user to `sts:AssumeRole`
2. In the **CPN AWS account**, give the IAM user an inline policy allowing `sts:AssumeRole` on the target role ARN
3. Add the IAM user's access keys to `.env`

## Development

### Available Scripts

- `npm run dev` — Start development server with hot reload
- `npm run build` — Build for production
- `npm start` — Start production server
- `npm run lint` — Run ESLint
- `npm test` — Run tests with Vitest

### Project Structure

```
app/                       # Next.js app directory
├── (app)/dashboard/       # Protected app routes
│   ├── sizing/            # Sizing tool page
│   └── cfm/               # CFM Analysis pages
│       ├── [accountId]/   # Account dashboard, scan, deep dive, export
│       └── page.tsx       # Landing (account grid)
├── (marketing)/           # Public marketing pages
├── api/                   # API routes
│   ├── auth/              # Authentication endpoints
│   ├── chat/              # AI chatbot (SSE streaming)
│   ├── sizing/            # Sizing autofill endpoint
│   ├── cfm/               # CFM accounts, scans, export
│   └── audit/             # Audit log queries
├── login/                 # Login page
└── signup/                # Signup page

components/                # React components
├── ui/                    # shadcn/ui components
├── studio/                # Canvas/editor components
├── sizing/                # Sizing tool components
├── chat/                  # Chatbot components (shared)
├── cfm/                   # CFM Analysis components
│   ├── AccountWizard.tsx  # 3-step connection wizard
│   ├── CfmDashboard.tsx   # Dashboard with summary + service grid
│   ├── ScanProgress.tsx   # Live SSE scan progress
│   ├── ServiceDeepDive.tsx# Per-service recommendations + chat
│   └── ExportDialog.tsx   # Excel/PDF export
├── audit/                 # Audit logging UI
└── marketing/             # Marketing page components

lib/                       # Utilities and business logic
├── audit/                 # Audit event writer
├── auth/                  # Authentication middleware
├── db/                    # Drizzle ORM client, schema, migrations
├── chat/                  # Chat agent client (Azure AI Foundry)
├── sizing/                # Sizing agent client, token management
├── cfm/                   # CFM module
│   ├── aws-connection.ts  # STS AssumeRole, test connection
│   ├── scanner.ts         # Scan orchestrator, prompt builder, parser
│   ├── queries.ts         # Account/scan/recommendation DB queries
│   ├── export-generator.ts# Excel + PDF report generation
│   ├── scan-events.ts     # In-memory event bus for SSE progress
│   ├── types.ts           # TypeScript interfaces
│   └── validators.ts      # Zod validation schemas
├── export/                # Data export utilities
├── spec/                  # Specification parser
└── contracts/             # Type definitions

hooks/                     # Custom React hooks
```

### Database

PostgreSQL with Drizzle ORM. Schema includes:

- **Users** — User accounts with authentication
- **Sessions** — Token-based session management
- **Projects** — Migration projects
- **AzureResources** — Imported Azure infrastructure
- **MappingRecommendations** — Generated AWS service mappings
- **AuditEvents** — Compliance and activity logs
- **Chats / ChatMessages** — AI chatbot conversation history
- **CfmAccounts** — Connected AWS accounts for CFM analysis
- **CfmScans** — Scan execution records with status and summary
- **CfmRecommendations** — Cost optimization recommendations per scan

## Testing

```bash
npm test
```

Property-based tests use `fast-check` (minimum 100 iterations) to validate:
- Input validation (AWS Account ID, Role ARN formats)
- Cascade delete consistency
- Unique constraints
- Credential non-persistence
- Scan state machine validity
- Export structure correctness

## License

MIT
