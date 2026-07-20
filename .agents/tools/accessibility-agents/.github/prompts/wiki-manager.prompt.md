---
name: wiki-management
description: Create, edit, organize, and search GitHub Wiki pages from the editor. Bypasses the wiki web UI for a more accessible experience.
mode: agent
agent: wiki-manager
tools:
  - askQuestions
  - readFile
  - runInTerminal
  - getTerminalOutput
---

# Wiki Manager

Manage GitHub Wiki pages entirely from the editor — create, edit, search, and organize wiki content without using the web UI.

## Input

**Task:** `${input:task}`

## Instructions

### Step 1: Understand the Wiki Task

Determine what the user needs:

- **Create** a new wiki page
- **Edit** an existing wiki page
- **Search** wiki content
- **List** all wiki pages
- **Organize** wiki structure (sidebar, footer)
- **View** page history

### Step 2: Execute

Use the GitHub API and git operations to manage wiki content. The wiki is a separate git repository at `{repo}.wiki.git`.

### Step 3: Verify

Confirm the operation completed successfully and show the result.
