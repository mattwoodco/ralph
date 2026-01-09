# PRD Generation Prompt

Generate a prd.json file for this project.

## Output Format

Create a prd.json with this structure:

```json
{
  "name": "Project Name",
  "description": "Brief description",
  "stories": [
    {
      "id": "story-id",
      "title": "Story Title",
      "description": "What needs to be done",
      "acceptance": ["Acceptance criteria 1", "Acceptance criteria 2"],
      "priority": "high|medium|low",
      "passes": false
    }
  ]
}
```

## Requirements

- **First story MUST run:**

  ```bash
  bunx create-next-app@latest app --ts --tailwind --no-eslint --app --src-dir --use-bun --yes && cd app && bunx shadcn@latest init -y && bun add --dev @biomejs/biome && bunx biome init
  ```

- Use Next.js 16 with App Router
- Use Tailwind CSS v4
- Use shadcn/ui components
- Use Biome for linting/formatting (not ESLint)
- Use TypeScript strict mode
- Include at least 24 user stories to arrive at a complete MVP
- Stories should cover: setup, core features, UI/UX, data layer, error handling, edge cases, polish, and testing

## Instructions

Write the prd.json file now based on the project description provided.
