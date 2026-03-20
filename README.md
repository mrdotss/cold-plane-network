# Cold Plane Network

A comprehensive **Azure to AWS migration advisor** and infrastructure mapping tool. Visualize, plan, and manage cloud migrations with intelligent service recommendations, compliance auditing, and interactive topology editing.

## Features

- **User Authentication** - Secure login with session management and password hashing
- **Project Management** - Create and organize migration projects
- **Azure Resource Import** - Ingest and parse Azure infrastructure
- **Intelligent Mapping** - AI-powered Azure to AWS service recommendations with confidence scores
- **Visual Network Editor** - Interactive topology visualization and editing with Dagre/XYFlow
- **Audit Logging** - Comprehensive compliance tracking with data redaction
- **Data Export** - Export migration plans as CSV or ZIP archives
- **Offline Support** - Client-side storage with IndexedDB

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, TailwindCSS, Shadcn UI
- **Backend**: Next.js API Routes with server-side logic
- **Database**: PostgreSQL with Drizzle ORM
- **Visualization**: Dagre + XYFlow for graph rendering
- **Testing**: Vitest with property-based testing (fast-check)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Set up environment variables:

```bash
cp .env.example .env
# Set DATABASE_URL to your PostgreSQL connection string
```

3. Run database migrations:

```bash
npx drizzle-kit migrate
```

4. Start the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

### Project Structure

```
app/               # Next.js app directory
├── (app)/         # Protected app routes
├── (marketing)/   # Public marketing pages
├── api/           # API routes (auth, projects, audit)
├── login/         # Login page
└── signup/        # Signup page

components/        # React components
├── ui/            # Shadcn UI components
├── studio/        # Canvas/editor components
├── audit/         # Audit logging UI
└── marketing/     # Marketing page components

lib/               # Utilities and business logic
├── audit/         # Audit logging system
├── auth/          # Authentication helpers
├── db/            # Drizzle ORM client, schema, and migrations
├── export/        # Data export utilities
├── spec/          # Specification parser
└── contracts/     # Type definitions

hooks/             # Custom React hooks
```

### Database

The project uses PostgreSQL with Drizzle ORM. The schema includes:

- **Users** - User accounts with authentication
- **Sessions** - Token-based session management
- **Projects** - Migration projects
- **AzureResources** - Imported Azure infrastructure
- **MappingRecommendations** - Generated AWS service mappings
- **AuditEvents** - Compliance and activity logs

## Testing

Run tests with Vitest:

```bash
npm test
```

Property-based tests use `fast-check` for comprehensive coverage.

## License

MIT
