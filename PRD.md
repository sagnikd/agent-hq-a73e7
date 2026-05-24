# Product Requirements Document — AgentHQ Outreach

**Version:** 1.0  
**Date:** 2026-05-23  
**Status:** Draft

---

## 1. Overview

AgentHQ is a self-hosted mission-control dashboard for AI agents. It gives any LLM agent (Claude Code, OpenClaw, Python scripts, curl) a persistent workspace: tasks, activity logs, forms, webhooks, and a live office view — all reachable via a single authenticated API.

The repo ships both the dashboard (React/Vite/Netlify) and four agent skill files that define autonomous behaviors agents can execute against it.

---

## 2. Core Platform Capabilities

### 2.1 The Office

- Live 2D scene visualizing registered AI agents with presence states (active, idle, offline)
- Status rings and heartbeat indicators per agent
- Real-time updates as agents post activity

### 2.2 Task Board (Kanban)

- 5-column kanban: `todo → in_progress → needs_input → done → archived`
- Agents create, move, and close task cards via API
- Each card holds title, description, status, and structured metadata
- Human can see agent progress live; pinch points surface in `needs_input`

### 2.3 Activity Feed

- Append-only, timestamped log of every agent action
- Categorized entries: `email`, `content`, `error`, `system`, etc.
- Powers the Office "ticker" so the human sees what happened and when
- Every form submission and webhook event auto-writes an entry

### 2.4 Agent Registry

- Register named agents with a description and status
- Heartbeat endpoint keeps the status ring current
- Useful for multi-agent setups to track which agent is alive

### 2.5 Forms

- Create named forms with typed fields (`text`, `email`, `textarea`, `tel`, `url`, `number`, `date`)
- Each form gets a public submission URL (`/f/<slug>`)
- Submissions stored in Netlify Blobs, readable via `form.submissions`
- Every submission writes an activity-log entry
- Forms can be embedded in landing pages via `{{form:slug}}` placeholder

### 2.6 Webhooks

- Catch-all inbound webhook URLs for external services (Cal.com, Stripe, GitHub, Zapier, AgentMail)
- Agents read and react to incoming payloads
- Health check action (`outreach.webhook.test`) to verify wiring

### 2.7 Integrations / API

- Single authenticated endpoint: `POST /api/command` with `X-API-Key` header
- Uniform action shape: `{ "action": "<group.verb>", "params": { ... } }`
- Self-documenting catalog exposed on the Integrations page of the dashboard
- Keys managed in `/settings`; no per-action auth complexity

---

## 3. Agent Skills

Skills are markdown instruction files placed in any LLM agent's skill folder. They define autonomous workflows that call the AgentHQ API.

### 3.1 `mission-control-outreach` — Email Outreach Pipeline

Full cold-outreach system gated by two explicit human approvals.

**Capabilities:**

| Capability | Detail |
|---|---|
| Campaign creation | Create named campaigns with natural-language or structured query |
| Lead scraping | Fire Apify against Google Maps; writes one lead record per result |
| Lead enrichment | Scrape each lead's homepage + /contact for email addresses; recovers ~40–70% of missing emails |
| Test lead seeding | Inject own email as a 🧪 TEST lead for demo/dry-run |
| Email drafting — agent | Agent writes draft directly: `outreach.emails.create` |
| Email drafting — Gemini | Gemini drafts per (lead, step): `outreach.emails.generate_one` (preferred) or batch `outreach.emails.generate` |
| Sequence frameworks | Apply multi-step frameworks (e.g. cold → follow-up → breakup) with `step` and `total_steps` params |
| Send | `outreach.emails.send` fires all approved drafts via AgentMail |
| Reply handling | AgentMail webhook fires on inbound reply; agent reads and can auto-respond |
| Analytics | Open/click/reply counters per campaign |
| Webhook health | `outreach.webhook.test` confirms AgentMail wiring |

**Gate pattern (explicit approval gates):**

1. **Gate 1** — Agent previews the campaign plan in natural language. Human approves before Apify runs.
2. **Gate 2** — Agent shows a sample email draft. Human approves before any email sends.

**Anti-patterns refused:**
- Sending without Gate 2 approval
- Importing leads from external CSVs (only Apify or manual add_test)
- Batch-generating for large campaigns (>10 leads) without `generate_one` loop

---

### 3.2 `mission-control-landing-page` — Landing Page Builder

Build and publish full HTML landing pages to `<AGENT_HQ_URL>/p/<slug>`.

**Capabilities:**

| Capability | Detail |
|---|---|
| Full-HTML mode | Agent writes complete, production-quality HTML/CSS; no framework constraints |
| Themed mode | Fallback for simple drafts; uses dashboard theming |
| Form embedding | `{{form:slug}}` placeholder auto-wires a live form into the page |
| Publish | `page.create` or `page.update` stores page; immediately live at `/p/<slug>` |
| Iteration | Agent reads current HTML, applies targeted edits, republishes |
| Activity logging | Each publish logs to activity feed with slug and live URL |

**Workflow (5 steps):**
1. Understand brief (audience, goal, brand)
2. Create contact form if needed (chain `form.create` first)
3. Write full HTML (inline CSS, responsive, no external dependencies)
4. Publish via API
5. Return live URL + log to activity

---

### 3.3 `mission-control-forms` — Form Management

Create and manage lead-capture / inquiry forms independently of landing pages.

**Capabilities:**

| Capability | Detail |
|---|---|
| Create form | `form.create` with slug, title, description, fields array |
| Field types | text, email, textarea, tel, url, number, date |
| Read submissions | `form.submissions` returns array of structured submission objects |
| Embed in pages | Reference by slug in landing page HTML |
| Convert to task | `form.convert_to_task` turns a submission into a kanban card |
| Activity integration | Every submission auto-logs to activity feed |

**Good form patterns included:**
- Demo request / sales inquiry
- Newsletter signup
- Event RSVP
- Feedback with rating

---

### 3.4 `mission-control-repurpose` — Content Repurposing

Given any URL, scrape and repurpose content into 5 formats, with an AI-generated image.

**Capabilities:**

| Capability | Detail |
|---|---|
| Web scrape | Reads URL, extracts topic, key points, data/quotes, tone |
| 5 repurposed outputs | LinkedIn post, Instagram carousel caption, Blog intro, X thread, Email newsletter snippet |
| Image generation | Gemini 2.5 Flash generates a 1080×1080 Instagram cover image |
| Task lifecycle | Creates task card → moves through statuses → marks done |
| Activity logging | Each step logged so human watches progress live |
| Error recovery | Failed steps log to activity + move card to `needs_input` |

---

## 4. Technical Architecture

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + Framer Motion + Lucide icons |
| Backend | Netlify Functions (serverless, Node) |
| Storage | Netlify Blobs (KV, no external DB) |
| Hosting | Netlify (free Starter tier) |
| Email sending | AgentMail (external, key required) |
| Lead scraping | Apify (external, key required) |
| AI drafting | Gemini 2.5 Flash (external, key required for Gemini path) |
| Deploy | One-click Netlify deploy button |

**Free tier limits (Netlify Starter):**
- 100 GB bandwidth/month
- 125K function invocations/month
- 1 GB Blobs storage
- Realistic agent usage: ~1–2% of function quota

---

## 5. API Design

All actions share one endpoint and shape:

```
POST /api/command
X-API-Key: ahq_...
{ "action": "group.verb", "params": { ... } }
```

Action groups:
- `activity.*` — log, list
- `task.*` — create, get, list, move, update
- `agent.*` — register, heartbeat, list
- `form.*` — create, update, submissions, convert_to_task
- `page.*` — create, update, get
- `outreach.campaign.*` — create, list, get, update, run, delete
- `outreach.leads.*` — list, count, add_test, enrich_one, delete
- `outreach.emails.*` — create, generate_one, generate, list, update, send
- `outreach.webhook.*` — test
- `outreach.replies.*` — list, get

---

## 6. Out of Scope (Current Version)

- Multi-user / team access (single-tenant, one API key)
- Native mobile app
- Built-in email provider (requires AgentMail key)
- CSV lead import (Apify only + manual seeding)
- CRM integrations (Salesforce, HubSpot)
- Paid hosting tier

---

## 7. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Function timeout | Each action completes under Netlify's 26s cap |
| Lead enrichment | Fails open — scraping block = skip, not crash |
| Apify run | Blocks 30s–3min; agent waits synchronously |
| Auth | API key header on every request; no OAuth |
| Cost | $0 at realistic personal-agent scale |
