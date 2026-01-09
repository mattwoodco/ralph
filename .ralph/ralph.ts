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
const PRD_PROMPT_PATH = `${configDir}/prd-prompt.md`;
const EXAMPLES_DIR = `${configDir}/examples`;

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

// Check if prd.json exists
async function prdExists(): Promise<boolean> {
  const file = Bun.file(PRD_PATH);
  return await file.exists();
}

// List available example PRD files
async function listExamples(): Promise<string[]> {
  const glob = new Bun.Glob("*.json");
  const examples: string[] = [];
  for await (const file of glob.scan(EXAMPLES_DIR)) {
    examples.push(file);
  }
  return examples.sort();
}

// Read user input from stdin
async function promptUser(question: string): Promise<string> {
  process.stdout.write(question);
  const reader = Bun.stdin.stream().getReader();
  const decoder = new TextDecoder();
  let input = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    input += decoder.decode(value);
    if (input.includes("\n")) break;
  }

  reader.releaseLock();
  return input.trim();
}

// Copy an example PRD to prd.json
async function copyExample(exampleName: string): Promise<void> {
  const sourcePath = `${EXAMPLES_DIR}/${exampleName}`;
  const content = await Bun.file(sourcePath).text();
  await Bun.write(PRD_PATH, content);
  logSuccess(`✅ Copied ${exampleName} to prd.json`);
}

// Create a new PRD using the AI agent
async function createPrdWithAgent(projectDescription: string): Promise<void> {
  const agentCmd = process.env.AGENT_CMD || "claude";
  const prdPromptTemplate = await Bun.file(PRD_PROMPT_PATH).text();

  const fullPrompt = `${prdPromptTemplate}

## Project Description

${projectDescription}

## Instructions

Based on the above project description, generate a complete prd.json file following all the guidelines.
Write the prd.json file to: .ralph/prd.json

Remember to:
1. Start with the init story
2. Break down features into atomic stories
3. Include validation criteria in every story
4. Set appropriate priorities
5. Write specific, testable acceptance criteria`;

  console.log(`\n🤖 Spawning AI agent to generate PRD...`);
  console.log(`   Using agent command: ${agentCmd}`);
  console.log(`   This may take a few minutes...\n`);

  try {
    const agentProc = Bun.spawn(
      agentCmd === "cursor-agent"
        ? [agentCmd, "-p", fullPrompt, "--output-format", "text"]
        : [agentCmd, "--dangerously-skip-permissions", "--print", "-p", fullPrompt],
      {
        stdout: "inherit",
        stderr: "inherit",
        cwd: projectRoot,
      }
    );

    const exitCode = await agentProc.exited;

    if (exitCode === 0) {
      // Verify the PRD was created
      if (await prdExists()) {
        logSuccess("\n✅ PRD created successfully!");
        const prd = await readPrd();
        const storyCount = prd.stories?.length ?? 0;
        console.log(`   Project: ${prd.name || "Unnamed"}`);
        console.log(`   Stories: ${storyCount}`);
      } else {
        logError("\n❌ Agent completed but prd.json was not created.");
        logError("   Please check the agent output and try again.");
        process.exit(1);
      }
    } else {
      logError(`\n❌ Agent exited with code ${exitCode}`);
      process.exit(1);
    }
  } catch (error) {
    logError(`❌ Error running agent: ${error}`);
    process.exit(1);
  }
}

// Initialize PRD - guide user through setup if prd.json doesn't exist
async function initializePrd(): Promise<boolean> {
  if (await prdExists()) {
    return true; // PRD exists, continue normally
  }

  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                     Welcome to Ralph! 🚀                          ║
╠══════════════════════════════════════════════════════════════════╣
║  No prd.json found. Let's set up your project.                   ║
║                                                                   ║
║  Choose an option:                                                ║
║    1. Copy an example PRD                                         ║
║    2. Create a new PRD with AI assistance                         ║
║    3. Exit                                                        ║
╚══════════════════════════════════════════════════════════════════╝
`);

  const choice = await promptUser("Enter your choice (1-3): ");

  switch (choice) {
    case "1": {
      // Copy from examples
      const examples = await listExamples();
      if (examples.length === 0) {
        logError("No example files found in .ralph/examples/");
        process.exit(1);
      }

      console.log("\nAvailable examples:\n");
      examples.forEach((example, index) => {
        const name = example.replace(".json", "").replace(/-/g, " ");
        console.log(`  ${index + 1}. ${name}`);
      });
      console.log();

      const exampleChoice = await promptUser(
        `Select an example (1-${examples.length}): `
      );
      const exampleIndex = parseInt(exampleChoice, 10) - 1;

      if (exampleIndex >= 0 && exampleIndex < examples.length) {
        await copyExample(examples[exampleIndex]);
        return true;
      } else {
        logError("Invalid selection.");
        process.exit(1);
      }
      break;
    }

    case "2": {
      // Create new PRD with agent
      console.log(`
📝 Describe your project. Include:
   - What the application does
   - Key features and functionality
   - Any specific requirements or integrations

   (Press Enter twice when done)
`);

      let description = "";
      let emptyLineCount = 0;

      while (emptyLineCount < 1) {
        const line = await promptUser("");
        if (line === "") {
          emptyLineCount++;
        } else {
          emptyLineCount = 0;
          description += line + "\n";
        }
      }

      description = description.trim();

      if (!description) {
        logError("No project description provided.");
        process.exit(1);
      }

      console.log("\n📋 Project description received:");
      console.log("─".repeat(50));
      console.log(description);
      console.log("─".repeat(50));

      const confirm = await promptUser("\nProceed with PRD generation? (y/n): ");
      if (confirm.toLowerCase() !== "y" && confirm.toLowerCase() !== "yes") {
        console.log("Cancelled.");
        process.exit(0);
      }

      await createPrdWithAgent(description);
      return true;
    }

    case "3":
      console.log("Goodbye!");
      process.exit(0);
      break;

    default:
      logError("Invalid choice. Please run again and select 1, 2, or 3.");
      process.exit(1);
  }

  return false;
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
  AGENT_CMD         Command used to invoke the AI agent (default: "claude")
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

GETTING STARTED:
  If no prd.json exists, Ralph will guide you through setup with two options:

  1. Copy an example PRD - Choose from pre-built examples in .ralph/examples/
  2. Create a new PRD - Describe your project and let the AI agent generate
     a complete PRD with stories, acceptance criteria, and priorities

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

// Main entry point: initialize PRD if needed, then run the loop
async function main(): Promise<void> {
  // Check if prd.json exists; if not, guide the user through setup
  const initialized = await initializePrd();
  if (!initialized) {
    process.exit(1);
  }

  // Run the main loop
  await runLoop(parseIterations());
}

main().catch((err) => {
  logError(String(err));
  process.exit(1);
});
