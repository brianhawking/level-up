# Level Up

An internal developer tool that helps you discover and adopt AI skills and tools relevant to your actual work.

## The Problem

There are hundreds of internal AI skills and tools across dozens of hubs and repos. No one has time to browse them. This tool bridges the gap — it reads your sprint tickets and matches them to tools that might actually help.

## How It Works

1. **Catalog** — paste a hub or repo URL, Claude reads it and extracts skill cards
2. **My Sprint** — your Jira tickets are displayed, hit "Find Tools" on any ticket and Claude matches it against your catalog
3. **Try List** — queue skills you want to try
4. **My Tools** — skills you've tried and decided to keep

## Running It

You need [Claude Code](https://claude.ai/code) installed (`claude` available in your terminal).

```bash
node server.js
```

Then open your browser at:

```
http://localhost:3000
```

That's it. No npm install, no dependencies — uses Node.js built-ins only.

## Project Structure

```
level-up.html   — the entire frontend (HTML, CSS, JS in one file)
server.js       — local Node.js server that proxies prompts to claude -p
```

## Current State

- Catalog ingestion from public URLs works (GitHub repos, websites)
- Sprint view with mock Jira tickets
- Ticket-to-tool matching via Claude
- Try List, done state, keep/dismiss flow, My Tools tab
- No persistence yet — catalog resets on page refresh (coming soon)
- Jira API integration pending (needs work network + token)

## Coming Soon

- localStorage persistence for catalog and My Tools
- Real Jira API integration
- Hub URL management (saved sources, re-sync)
- Level up progress tracking
