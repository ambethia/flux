# Custom Project Prompts

Flux supports per-project custom system prompts for work, retro, and review phases. This allows projects to override the built-in agent prompts with custom instructions.

## Overview

Each project can define three optional custom prompts:
- **workPrompt**: Instructions for the work phase (implementing issues)
- **retroPrompt**: Instructions for the retrospective phase
- **reviewPrompt**: Instructions for the review phase

When a custom prompt is not provided, Flux uses the built-in default prompts.

## Setting Custom Prompts

Use the Convex `projects:update` mutation to set custom prompts:

```bash
bunx convex run projects:update '{
  "projectId": "YOUR_PROJECT_ID",
  "workPrompt": "Your custom work prompt here..."
}'
```

## Placeholder Tokens

Custom prompts support placeholder tokens that Flux replaces with actual issue data at runtime.

### Work Prompt Placeholders

- `{{ISSUE}}` - Full issue text including title, description, and comments

Example:
```
You are a specialized agent for this project.

Complete the following issue:

{{ISSUE}}

Follow the project coding standards.
```

### Retro Prompt Placeholders

- `{{SHORT_ID}}` - Issue short ID (e.g., "FLUX-123")
- `{{WORK_NOTE}}` - Summary from the work session's disposition note

Example:
```
Retrospective for {{SHORT_ID}}

Work summary: {{WORK_NOTE}}

Identify any tooling friction or process improvements.
```

### Review Prompt Placeholders

- `{{SHORT_ID}}` - Issue short ID
- `{{TITLE}}` - Issue title
- `{{DESCRIPTION}}` - Issue description
- `{{DIFF}}` - Git diff of changes
- `{{COMMIT_LOG}}` - Git commit log
- `{{REVIEW_ITERATION}}` - Current review iteration number
- `{{MAX_REVIEW_ITERATIONS}}` - Maximum review iterations
- `{{RELATED_ISSUES}}` - List of related follow-up issues

Example:
```
Code Review for {{SHORT_ID}}: {{TITLE}}

Iteration {{REVIEW_ITERATION}} of {{MAX_REVIEW_ITERATIONS}}

## Changes

{{DIFF}}

## Commits

{{COMMIT_LOG}}

## Known Follow-ups

{{RELATED_ISSUES}}

Review for correctness and style.
```

## Clearing Custom Prompts

To revert to the default prompts, set the prompt fields to empty strings:

```bash
bunx convex run projects:update '{
  "projectId": "YOUR_PROJECT_ID",
  "workPrompt": "",
  "retroPrompt": "",
  "reviewPrompt": ""
}'
```

## Best Practices

1. **Keep prompts focused**: Custom prompts should complement the built-in instructions, not replace core functionality
2. **Use placeholders**: Always use placeholder tokens instead of hardcoding issue details
3. **Test incrementally**: Start with one phase (e.g., work) before customizing all three
4. **Version control**: Consider storing your custom prompts in a project-specific config file for version control

## Example: Project-Specific Code Style

```bash
bunx convex run projects:update '{
  "projectId": "k123...",
  "workPrompt": "You are a Flux autonomous agent working on our TypeScript microservices project.

## Code Standards

- Use strict TypeScript with no `any` types
- Prefer functional programming patterns
- All API responses must include error handling
- Write JSDoc comments for public functions

## Issue

{{ISSUE}}

## Deliverables

Complete the task and ensure all tests pass before committing."
}'
```

## Implementation Details

- Custom prompts are stored in the `projects` table in Convex
- Prompts are fetched during `ProjectRunner.subscribe()` and cached for the runner's lifetime
- If project config is updated while a runner is active, restart the daemon to pick up changes
- Empty or undefined prompts fall back to built-in defaults

## Testing

Run the custom prompts test suite:

```bash
bun test src/server/orchestrator/agents/custom-prompts.test.ts
```
