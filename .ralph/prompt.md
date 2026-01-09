# Ralph Agent Instructions

## Your Task

1. Read `.ralph/prd.json` to understand the outstanding stories.
2. Read `.ralph/progress.md` to learn from previous iterations and discover codebase patterns.
3. Choose the highest priority story where `passes: false`. Priority order: `high` > `medium` > `low`.
4. Implement that **one** story in the codebase.
5. Run linting and type checking (`bunx biome lint --apply` and `bunx tsgo`) and fix any issues.
6. Commit your changes with the message `feat(STORY_ID): STORY_TITLE`.
7. Update `.ralph/prd.json` for that story by setting `passes: true`.
8. Append an entry to `.ralph/progress.md` summarising what you implemented, which files you changed, and what you learned. Use the format described below.

## PRD Format

```json
{
  "name": "My Project",
  "stories": [
    {
      "id": "setup",
      "title": "Initialize project",
      "description": "What the user wants",
      "acceptance": ["Verifiable criteria", "Something agent can check"],
      "priority": "high",
      "passes": false
    }
  ]
}
```

- **id**: Human-readable identifier (used in branches and commit messages)
- **title**: Short title for the story
- **description**: Detailed description of what the user wants
- **acceptance**: Array of verifiable acceptance criteria
- **priority**: One of `"high"`, `"medium"`, or `"low"`
- **passes**: Boolean indicating if the story is complete

## Progress Format

When appending to `.ralph/progress.md`, use the following template. Place new entries **after** the separator (`---`) so that the `Codebase Patterns` section always remains at the top:

```
## YYYY‑MM‑DD - [Story ID]
- What was implemented
- Files changed
- **Learnings:**
  - Patterns discovered
  - Gotchas encountered
---
```

## Codebase Patterns

Add reusable patterns to the top of `.ralph/progress.md` in the `Codebase Patterns` section. For example:

```
- Migrations: Use IF NOT EXISTS when modifying schema
- React: useRef<Timeout | null>(null)
```

## Stop Condition

If **all** stories in `.ralph/prd.json` have `passes: true`, output the exact text below on its own line:

```
<promise>COMPLETE</promise>
```

Otherwise end normally without the promise marker.
