# Ralph - it's just a for loop

![ralph logo](.ralph/ralph.png)

## Install

```bash
# get bun
curl -fsSL https://bun.sh/install | bash

# get ralph
git clone https://github.com/mattwoodco/ralph.git
cd ralph && bun install
```

Also need [Claude CLI](https://docs.anthropic.com/en/docs/claude-cli) (`claude`). Optionally [Cursor](https://cursor.com) for `cursor-agent`.

## Quick Start (Recommended)

Add these to your `~/.zshrc`:

```bash
# Clone ralph as a new project
ralph() {
  echo "Name of your project: " && read project \
  && git clone https://github.com/mattwoodco/ralph.git $project \
  && cd $project \
  && rm -rf .git \
  && git init \
  && bun install \
  && cursor .
}

# Clone ralph and auto-generate PRD with Claude
run-ralph() {
  local description="$1"
  local project_name="$2"

  if [ -z "$description" ]; then
    echo "Usage: run-ralph \"project description\" [project-name]"
    echo "Example: run-ralph \"a tic tac toe game with dark mode\" my-project"
    return 1
  fi

  if [ -z "$project_name" ]; then
    project_name="ralph-$(date +%Y%m%d-%H%M%S)"
  fi

  echo "🚀 Starting ralph project: $project_name"
  echo "📝 Description: $description"

  git clone https://github.com/mattwoodco/ralph.git "$project_name" && cd "$project_name" \
  && rm -rf .git && git init && bun install \
  && claude --dangerously-skip-permissions -p "Project: $description

$(cat .ralph/prd-prompt.md)" --max-turns 10 \
  && bun ralph
}
```

Then:

```bash
# Interactive - prompts for project name
ralph

# Auto-generate PRD and run
run-ralph "a todo app with dark mode"
run-ralph "a dashboard for tracking expenses" my-expense-app
```

## Run

```bash
bun run ralph
```

Edit `.ralph/prd.json` to change the task list.

## Run from anywhere

**Mac/Linux** — add to `~/.zshrc`:

```bash
alias ralph="bun run --cwd ~/ralph ralph"
```

**Windows** — add to PowerShell profile (`notepad $PROFILE`):

```powershell
function ralph { bun run --cwd "$HOME\ralph" ralph $args }
```

Then just: `ralph`

## Options

```bash
bun run ralph 5              # max 5 iterations
bun run ralph --cursor       # use cursor-agent instead of claude
bun run ralph --help         # all options
RALPH_DRY_RUN=1 bun run ralph  # preview mode
```

## License

MIT
