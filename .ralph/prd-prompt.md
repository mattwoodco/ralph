# PRD Generation Prompt

Generate a prd.json file for this project following the standardized format below.

## Output Format

Create a prd.json with this structure:

```json
{
  "name": "Project Name",
  "description": "Brief description of what this project does",
  "stories": [
    {
      "id": "story-id",
      "title": "Story Title",
      "description": "What needs to be done and why",
      "acceptance": [
        "Specific acceptance criterion 1",
        "Specific acceptance criterion 2",
        "`bunx biome check .` passes with no errors",
        "`bunx tsc --noEmit` passes with no type errors",
        "`bun run build` completes successfully"
      ],
      "priority": "high",
      "passes": false
    }
  ]
}
```

## Story Schema

Each story MUST only contain these fields:
- `id` - Unique identifier (kebab-case)
- `title` - Short descriptive title
- `description` - What needs to be done and context
- `acceptance` - Array of specific, testable acceptance criteria
- `priority` - One of: `"high"`, `"medium"`, `"low"`
- `passes` - Always `false` initially

## Required Stories

### 1. INIT Story (First Story)

Every PRD MUST start with this story:

```json
{
  "id": "init",
  "title": "Initialize Next.js project",
  "description": "Bootstrap with Next.js, TypeScript, Tailwind, shadcn/ui, PostgreSQL, and Drizzle",
  "acceptance": [
    "`bunx create-next-app@latest [app-name] --ts --tailwind --biome --app --src-dir --use-bun --no-turbopack --no-import-alias`",
    "`bunx shadcn@latest init -y --base-color=neutral`",
    "Docker Compose with PostgreSQL, Drizzle ORM configured, .env.example documented",
    "`bun dev` runs on localhost:3000",
    "`bunx biome check .` and `bunx tsc --noEmit` pass, `bun run build` succeeds"
  ],
  "priority": "high",
  "passes": false
}
```

## Standard Tech Stack

All PRDs must use this stack:

| Technology | Purpose | Command/Config |
|------------|---------|----------------|
| **Next.js 16** | Framework | See init command above |
| **TypeScript** | Type safety | Strict mode in tsconfig.json |
| **Tailwind CSS v4** | Styling | CSS-first configuration |
| **shadcn/ui** | Components | `bunx shadcn@latest init -y --base-color=neutral` |
| **Biome** | Linting/formatting | `--biome` flag in create-next-app |
| **Docker** | Containers | docker-compose.yml with PostgreSQL |
| **PostgreSQL 16** | Database | Via Docker Compose |
| **Drizzle ORM** | Database ORM | `bun add drizzle-orm postgres` |
| **Zod** | Validation | `bun add zod` |
| **bun** | Package manager | All commands use bun/bunx |

## Validation Requirements

**EVERY story** must end with these three acceptance criteria:

```json
"`bunx biome check .` passes with no errors",
"`bunx tsc --noEmit` passes with no type errors",
"`bun run build` completes successfully"
```

This ensures code quality is maintained after every story completion.

## Story Design Principles

### Atomic Tasks
- Each story should be completable independently
- Single responsibility - one feature or fix per story
- No implicit dependencies on unfinished stories
- Clear, testable acceptance criteria

### Story Breakdown Guidelines

**DO split stories when:**
- A feature touches multiple layers (schema, API, UI)
- There are distinct sub-features
- The story has more than 8-10 acceptance criteria

**Example breakdown:**
```
BAD:  "User authentication system"
GOOD: "auth-schema" → "auth-api" → "auth-login-ui" → "auth-register-ui" → "auth-middleware"
```

### Recommended Story Categories

1. **Setup** - Project init, Docker, database config
2. **Schema** - Database tables (one per table or related group)
3. **API** - API routes (grouped by resource)
4. **UI** - Pages and components (one per page/feature)
5. **Integration** - Third-party services (Stripe, auth providers, etc.)
6. **Polish** - Error handling, loading states, responsive design

## Architecture Rules

1. **API Routes Only** - All data fetching goes through `/api/*` routes
2. **No Server Components for Data** - Use client components with API calls
3. **Zod Validation** - Validate all inputs with Zod schemas
4. **Type Safety** - Export types from schema files, no `any` types
5. **Docker for Services** - PostgreSQL and any other services run in Docker

## Minimum Story Count

Include at least **20-30 stories** for a complete MVP covering:
- Setup and infrastructure (3-5 stories)
- Database schema (3-6 stories)
- Core API routes (4-8 stories)
- UI pages and components (6-12 stories)
- Polish and error handling (2-4 stories)

## Instructions

When generating a PRD:

1. Start with LOCAL-SETUP and init stories
2. Break down features into atomic, independent stories
3. Ensure every story has the 3 validation criteria at the end
4. Use consistent ID naming (kebab-case, grouped by feature)
5. Order stories by dependency (schema before API before UI)
6. Write specific, testable acceptance criteria
7. Set appropriate priorities (high for core, medium for features, low for polish)

Write the prd.json file now based on the project description provided.
