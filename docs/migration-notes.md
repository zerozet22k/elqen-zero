# Migration Notes

## Structural Audit

The original repository was not a single coherent app. It contained separate project roots and checked-in runtime artifacts:

- a CRA client in `client`
- an Express server in `server`
- a Rasa bot workspace in `chatbot-brain`
- a checked-in Python virtualenv in `rasaenv`
- nested `.git` directories inside the old client and server
- checked-in `node_modules`, `build`, and generated model archives

The backend already used MongoDB through Mongoose, which aligns with the new target stack. That is the main salvageable implementation decision. The existing code structure itself was not safe to extend.

## What Was Structurally Broken

### 1. No unified workspace boundary

The root folder was not the application repo. It was a container around multiple nested repos plus generated assets.

### 2. Legacy artifacts lived in active app paths

Checked-in `node_modules`, `build`, `.env`, model archives, and a Python virtualenv sat next to runtime code, making the working tree noisy and unsafe to maintain.

### 3. Messaging model was platform-shaped, not domain-shaped

The existing server stored:

- `Chatbot`
- `ChatUser`
- `Chat`
- `ChatMessage`

That model ties persistence to bot/platform entities instead of:

- workspaces
- channel connections
- contacts
- conversations
- canonical messages
- delivery records

### 4. Provider mapping logic leaked outside adapters

Webhook parsing, outbound sending, and platform conditionals were mixed into route and service code. There was no adapter registry and no canonical message boundary.

### 5. Raw and normalized representations were not separated cleanly

The old `ChatMessage` stored mixed `payload` and `message` fields without a canonical schema strong enough for UI, automation, and AI.

### 6. Facebook support was incomplete in the core path

The webhook handler returned early for Facebook instead of normalizing Messenger messages into the same flow as Telegram and Viber.

### 7. The client was not an inbox architecture

The React app centered on chatbot CRUD and flow-builder style pages, not a unified inbox with canonical thread rendering, channel badges, contact panels, and message composer flows.

### 8. Active runtime used demo and mock shortcuts

The rebuilt runtime initially still had:

- auto-created demo workspaces
- mock channel send success
- fake connection defaults in the UI
- automation replies mislabeled as `ai`

Those shortcuts were removed from the active app paths.

## What Was Isolated

Archived under `/legacy`:

- `client-cra-2025`
- `server-express-2025`
- `chatbot-brain-rasa`
- `rasaenv`
- generated repo tree dump and Python version marker

Because the old client and server each contained embedded `.git` metadata, archive remnants were split into:

- `client-cra-2025-git-meta`
- `server-express-2025-git-meta`

Those are retained only to preserve the original archive and are not part of the active app.

## What Is Replaced

The active application is rebuilt around:

- canonical TypeScript types
- Mongoose models aligned to workspace, conversations, messages, and channel connections
- per-channel adapters
- modular webhook and API routes
- a dedicated inbox UI
- real channel connection validation and webhook registration flows
- honest connection statuses and delivery failures

## Intentionally Deferred

- TikTok production messaging support until public/business messaging support is verified
- full media outbound parity across all channels in v1
- advanced analytics beyond a basic dashboard summary
- production-grade secret encryption and key management beyond structured credential storage

## Remaining TODO After Phase 1

- real socket transport if realtime push is required beyond HTTP refresh
- production secret encryption/key management
- provider delivery receipt callbacks beyond initial send acceptance

## Migration Principle

The new app does not patch the old webhook and bot code in place. Legacy code is archived. The active codebase is rebuilt on documented adapter boundaries so future channels can be added without rewriting storage, UI, or AI logic.
