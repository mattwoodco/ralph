# Ralph - it's just a for loop

![ralph logo](.ralph/ralph.png)

## Setup

```bash
curl -fsSL https://bun.sh/install | bash
git clone https://github.com/mattwoodco/ralph.git && cd ralph && bun install
```

Need [Claude CLI](https://docs.anthropic.com/en/docs/claude-cli). Optional: [Cursor](https://cursor.com) for `--cursor` mode.

## Run

```bash
bun ralph           # runs tasks from .ralph/prd.json
bun ralph 5         # max 5 iterations
bun ralph --cursor  # use cursor-agent
bun ralph --help    # all options
```

## License

MIT
