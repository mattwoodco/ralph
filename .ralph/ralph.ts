#!/usr/bin/env bun
/**
 * Minimal Ralph‑style loop implemented in TypeScript for Bun.
 *
 * This script reads the product requirements from a JSON file (prd.json),
 * selects the highest‑priority incomplete story, and invokes an AI agent
 * with a static prompt (prompt.md) to work on that story.  After each
 * iteration it lints and type checks the codebase with Biome and tsc and
 * commits the changes.  Progress and learnings are recorded in
 * progress.md, and the state of completed stories is updated in prd.json.
 *
 * Environment variables:
 *   AGENT_CMD      Command used to invoke the AI agent (default: "claude").
 *   MAX_ITERATIONS Override the default maximum number of loop iterations.
 *   RALPH_DRY_RUN  Set to "1" to enable dry-run mode (no commits or file modifications).
 */

import { $ } from "bun";

// Type definitions for PRD structure
type Priority = "high" | "medium" | "low";

interface Story {
  id: string;
  title: string;
  description?: string;
  acceptance?: string[];
  priority?: Priority;
  passes?: boolean;
}

interface Prd {
  name?: string;
  stories?: Story[];
}

// Priority order for sorting (lower number = higher priority)
const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

// Determine config directory (.ralph/) and project root (parent directory).
const configDir = import.meta.dir;
const projectRoot = `${configDir}/..`;

const PRD_PATH = `${configDir}/prd.json`;
const PROGRESS_PATH = `${configDir}/progress.md`;
const PROMPT_PATH = `${configDir}/prompt.md`;

// Read JSON from disk and parse it into an object.
async function readPrd(): Promise<Prd> {
  return await Bun.file(PRD_PATH).json();
}

// Write the PRD object back to JSON on disk.
async function writePrd(prd: Prd): Promise<void> {
  await Bun.write(PRD_PATH, JSON.stringify(prd, null, 2) + "\n");
}

// Append a message to progress.md.  The separator --- must remain at the top
// of the file to keep the Codebase Patterns section separate from the log.
async function appendProgress(entry: string): Promise<void> {
  const existing = await Bun.file(PROGRESS_PATH).text();
  // Insert the entry just before the final separator.  If the separator does
  // not exist, append the entry to the end of the file.
  const separator = "\n---\n";
  const index = existing.lastIndexOf(separator);
  let updated: string;
  if (index >= 0) {
    const before = existing.slice(0, index + separator.length);
    const after = existing.slice(index + separator.length);
    updated = `${before}\n${entry.trim()}\n${after}`;
  } else {
    updated = `${existing.trim()}\n\n${entry.trim()}\n`;
  }
  await Bun.write(PROGRESS_PATH, updated);
}

// Check if dry-run mode is enabled
function isDryRun(): boolean {
  return process.env.RALPH_DRY_RUN === "1";
}

// ANSI color codes for console output
const ANSI_RESET = "\x1b[0m";
const ANSI_GREEN = "\x1b[32m";
const ANSI_YELLOW = "\x1b[33m";
const ANSI_RED = "\x1b[31m";

// Colored console output helpers
function logSuccess(message: string): void {
  console.log(`${ANSI_GREEN}${message}${ANSI_RESET}`);
}

function logWarning(message: string): void {
  console.warn(`${ANSI_YELLOW}${message}${ANSI_RESET}`);
}

function logError(message: string): void {
  console.error(`${ANSI_RED}${message}${ANSI_RESET}`);
}

// Main loop: runs up to maxIterations or until all stories are complete.
async function runLoop(maxIterations: number): Promise<void> {
  const agentCmd = process.env.AGENT_CMD || "claude";
  const dryRun = isDryRun();
  console.log(`🚀 Starting Ralph loop using agent command "${agentCmd}"`);
  if (dryRun) {
    console.log(
      "🔍 DRY-RUN MODE: No commits or file modifications will be made"
    );
  }

  for (let i = 1; i <= maxIterations; i++) {
    console.log(`\n═══ Iteration ${i}/${maxIterations} ═══`);

    const prd = await readPrd();
    const stories = (prd.stories ?? []).filter((s) => !s.passes);

    if (stories.length === 0) {
      logSuccess("✅ All stories completed.");
      break;
    }

    // Sort by priority (high > medium > low); fall back to insertion order if equal.
    stories.sort((a, b) => {
      const aPriority = PRIORITY_ORDER[a.priority ?? "low"];
      const bPriority = PRIORITY_ORDER[b.priority ?? "low"];
      return aPriority - bPriority;
    });
    const currentStory = stories[0];

    console.log(`📋 Working on: ${currentStory.id} - ${currentStory.title}`);
    console.log(`   Remaining stories: ${stories.length}`);

    // Read the prompt from file
    const prompt = await Bun.file(PROMPT_PATH).text();

    // Run the agent command with the prompt as argument (cursor-agent style)
    // cursor-agent -p "prompt" --output-format text
    console.log(`🤖 Running agent...`);
    let agentSucceeded = false;
    let completionDetected = false;

    try {
      const agentProc = Bun.spawn(
        agentCmd === "cursor-agent"
          ? [agentCmd, "-p", prompt, "--output-format", "text"]
          : [
              agentCmd,
              "--dangerously-skip-permissions",
              "--print",
              "-p",
              prompt,
            ],
        {
          stdout: "pipe",
          stderr: "pipe",
          cwd: projectRoot,
        }
      );

      const exitCode = await agentProc.exited;
      const stdout = await new Response(agentProc.stdout).text();
      const stderr = await new Response(agentProc.stderr).text();
      const output = stdout + stderr;

      // Show agent output
      if (stdout.trim()) {
        console.log(
          "   Agent output:",
          stdout.slice(0, 200) + (stdout.length > 200 ? "..." : "")
        );
      }

      if (exitCode === 0) {
        agentSucceeded = true;
        logSuccess("✅ Agent completed successfully.");
      } else {
        logWarning(`⚠️  Agent exited with code ${exitCode}`);
        if (stderr.trim()) {
          logWarning("   Error: " + stderr.slice(0, 200));
        }
      }

      // Check for completion promise.
      if (output.includes("<promise>COMPLETE</promise>")) {
        completionDetected = true;
        logSuccess("✅ Completion promise detected.");
      }
    } catch (error) {
      logError(`❌ Error running agent command: ${error}`);
    }

    if (completionDetected) {
      logSuccess("🎉 All work complete. Exiting.");
      break;
    }

    // Only proceed with lint/typecheck/commit if agent succeeded
    if (!agentSucceeded) {
      logWarning("⏭️  Skipping post-processing (agent did not succeed).");
      continue;
    }

    // Lint the project
    console.log("🧹 Running lint...");
    try {
      await $`bunx biome lint --apply .`.quiet();
      logSuccess("✅ Lint complete.");
    } catch {
      logWarning("⚠️  Lint had errors (continuing anyway)");
    }

    // Type check the project using bun's built-in tsc
    console.log("🔍 Running type check...");
    try {
      await $`bun --bun x tsc --noEmit`.quiet();
      logSuccess("✅ Type check complete.");
    } catch {
      logWarning("⚠️  Type check had errors (continuing anyway)");
    }

    // Commit changes (skip in dry-run mode)
    if (dryRun) {
      console.log(
        "📦 [DRY-RUN] Would commit changes with message:",
        `feat(${currentStory.id}): ${currentStory.title}`
      );
    } else {
      console.log("📦 Committing changes...");
      try {
        await $`git add .`.quiet();
        const commitResult =
          await $`git commit -m ${`feat(${currentStory.id}): ${currentStory.title}`}`.nothrow();
        if (commitResult.exitCode === 0) {
          logSuccess("✅ Commit done.");
        } else {
          console.log("ℹ️  No changes to commit.");
        }
      } catch {
        logWarning("⚠️  Git commit had errors");
      }
    }

    // Mark the story as passed and write back the PRD (skip in dry-run mode)
    if (dryRun) {
      console.log(
        `[DRY-RUN] Would mark ${currentStory.id} as passed in prd.json`
      );
      console.log(`[DRY-RUN] Would append progress entry to progress.md`);
    } else {
      currentStory.passes = true;
      await writePrd(prd);
      logSuccess(`✅ Marked ${currentStory.id} as passed.`);

      // Append an entry to progress.md
      const date = new Date().toISOString().split("T")[0];
      const progressEntry = `## ${date} - ${currentStory.id}
- Implemented ${currentStory.title}
- Files changed: See git commit
- **Learnings:**
  - Describe patterns and gotchas discovered here
---`;
      await appendProgress(progressEntry);
    }

    // Wait briefly before next iteration to avoid overwhelming the agent.
    if (i < maxIterations) {
      console.log("⏳ Waiting before next iteration...");
      await Bun.sleep(2000);
    }
  }

  console.log("\n🏁 Ralph loop finished.");
}

// Display help information and exit.
function showHelp(): void {
  console.log(`Ralph - Autonomous coding loop for Bun

USAGE:
  bun ralph.ts [MAX_ITERATIONS]
  bun ralph.ts --help
  bun ralph.ts -h

ARGUMENTS:
  MAX_ITERATIONS    Maximum number of loop iterations (default: 10)

ENVIRONMENT VARIABLES:
  AGENT_CMD         Command used to invoke the AI agent (default: "cursor-agent")
  MAX_ITERATIONS    Override the default maximum number of loop iterations
  RALPH_DRY_RUN     Set to "1" to enable dry-run mode (no commits or file modifications)

EXAMPLES:
  bun ralph.ts
    Run the Ralph loop with default settings (10 iterations max)

  bun ralph.ts 5
    Run the Ralph loop with a maximum of 5 iterations

  AGENT_CMD=my-agent bun ralph.ts
    Run the Ralph loop using "my-agent" as the agent command

  MAX_ITERATIONS=20 bun ralph.ts
    Run the Ralph loop with a maximum of 20 iterations

  RALPH_DRY_RUN=1 bun ralph.ts
    Run the Ralph loop in dry-run mode (preview changes without committing)

DESCRIPTION:
  This script reads product requirements from prd.json, selects the highest-
  priority incomplete story, and invokes an AI agent to work on that story.
  After each iteration it lints and type checks the codebase, commits changes,
  and updates progress tracking files.
`);
}

// Parse max iterations from args or environment.
function parseIterations(): number {
  const argValue = process.argv[2];
  const envValue = process.env.MAX_ITERATIONS;
  const parsed = parseInt(argValue || envValue || "", 10);
  return isFinite(parsed) && parsed > 0 ? parsed : 10;
}

// Check for help flags
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  showHelp();
  process.exit(0);
}

runLoop(parseIterations()).catch((err) => {
  logError(String(err));
  process.exit(1);
});
