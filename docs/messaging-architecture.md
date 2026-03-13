# Messaging Architecture

## Why Channel Adapters Are Required

Facebook Messenger, Telegram, Viber, and future channels do not share a stable event model. Their webhook payloads, send APIs, message identifiers, media semantics, and feature limits differ enough that a provider-specific code path is unavoidable at the edges.

The system therefore uses:

1. A canonical internal message and conversation model for storage, UI, automation, and AI.
2. A per-channel adapter layer for inbound parsing and outbound rendering.
3. Raw payload retention so nothing provider-specific is lost.

This avoids the two common failure modes:

1. Treating one provider schema as the system schema.
2. Spreading provider-specific conditionals across routes, services, and UI components.

## Canonical Model

### Canonical channels

- `facebook`
- `telegram`
- `viber`
- `tiktok`

### Canonical message kinds

- `text`
- `image`
- `video`
- `audio`
- `file`
- `location`
- `contact`
- `interactive`
- `unsupported`
- `system`

### Canonical sender types

- `customer`
- `agent`
- `automation`
- `ai`
- `system`

Rule:

- static after-hours replies are `automation`
- canned replies are `automation`
- retrieval-based knowledge replies are `automation`
- only model-generated replies are `ai`

### Canonical directions

- `inbound`
- `outbound`

### Canonical delivery statuses

- `received`
- `queued`
- `sent`
- `delivered`
- `read`
- `failed`

## Raw vs Normalized Storage

Every inbound or outbound message event stores two representations:

1. `raw`
   The exact provider payload or provider send response/request envelope.
2. Canonical fields
   The normalized message used by the UI, filtering, automation, analytics, and AI.

The UI never renders raw provider payloads directly. The AI never reads raw provider payloads directly.

If a provider sends content that cannot be safely normalized, the system stores:

- `kind: unsupported`
- `unsupportedReason`
- the exact `raw` payload

That preserves fidelity without introducing undefined behavior elsewhere in the app.

## Inbound Flow

`provider webhook -> channel adapter -> canonical message(s) -> persistence -> conversation service -> automation/AI -> inbox UI`

Detailed inbound sequence:

1. A webhook route receives the provider request.
2. The route resolves the correct `channel_connection`.
3. The adapter verifies the webhook if the provider supports verification.
4. The adapter parses the provider payload into one or more canonical messages.
5. The message service stores:
   - the canonical message
   - the exact raw payload
6. The conversation service finds or creates the conversation using:
   - `workspaceId`
   - `channel`
   - `channelAccountId`
   - `externalChatId`
7. The contact service finds or creates the contact using the canonical sender identity.
8. Conversation preview, unread count, and timestamps are updated.
9. `channel_connections.lastInboundAt` is updated.
10. Automation and AI services read canonical history only.

## Outbound Flow

`agent reply or AI reply -> canonical outbound command -> adapter renderer -> provider send API -> delivery record`

Detailed outbound sequence:

1. The UI or automation submits a canonical outbound command.
2. The outbound message service loads the conversation and its channel connection.
3. The adapter registry selects the correct adapter.
4. The service checks channel capabilities before sending.
5. The adapter renders the canonical message into the provider API request.
6. The provider response is stored in `raw`.
7. `message_deliveries` records the send result and delivery status.
8. `channel_connections.lastOutboundAt` or `lastError` is updated honestly.

No provider-specific send payload construction is allowed outside adapter classes.

There is no mock send path in the active runtime. If credentials are missing or validation failed, send attempts fail and the conversation composer stays blocked.

## AI Integration Boundaries

The AI layer is intentionally downstream of normalization.

AI inputs:

- canonical conversation history
- business hours
- automation rules
- canned replies
- knowledge items
- AI settings

AI exclusions:

- raw Facebook webhook payloads
- raw Telegram updates
- raw Viber events
- provider send API responses

Decision order:

1. Rule match or canned reply
2. Knowledge retrieval
3. AI-generated response if confidence is sufficient
4. Human handoff if confidence is low or content is unsupported

All AI actions write audit logs with confidence and reasoning metadata.

If no model call exists, the app does not label a message `ai`.

## Channel Capability Matrix

Each adapter exposes a `ChannelCapabilities` object. This makes unsupported sends explicit instead of relying on runtime guesswork.

Example use:

- Telegram may allow inbound `location`, but outbound `contact` may remain disabled in MVP.
- TikTok remains scaffold-only until public messaging support is verified.

Capability checks happen before an outbound provider request is attempted.

## Unsupported Message Handling

Unsupported content is preserved, not dropped.

Rules:

1. Store the exact raw payload.
2. Normalize to `kind: unsupported`.
3. Set `unsupportedReason`.
4. Render a visible placeholder in the inbox UI.
5. Block AI auto-reply if unsupported content prevents understanding.
6. Prefer human handoff over hallucination.

## Data Model Overview

Primary collections:

- `users`
- `workspaces`
- `channel_connections`
- `contacts`
- `conversations`
- `messages`
- `message_deliveries`
- `automation_rules`
- `business_hours`
- `knowledge_items`
- `canned_replies`
- `ai_settings`
- `audit_logs`

Conversation documents carry assignment, status, unread count, preview, and AI state. Message documents carry canonical content plus raw payloads. Delivery records track outbound attempts separately from message content.

`channel_connections` also carry:

- `status`
- `webhookUrl`
- `webhookVerified`
- `verificationState`
- `lastInboundAt`
- `lastOutboundAt`
- `lastError`

## Target Folder Structure

```text
/docs
  messaging-architecture.md
  api-contracts.md
  migration-notes.md

/server
  /src
    /config
    /db
    /models
    /channels
    /routes
      /webhooks
      /api
    /services
    /lib
    /middleware
    /tests

/client
  /src
    /pages
    /components
    /features
      /inbox
      /contacts
      /channels
      /knowledge
      /automations
      /settings
    /services
    /hooks
    /types
    /utils

/legacy
```

## Phase Boundaries

- Phase 0
  Archive legacy code and establish clean repo boundaries.
- Phase 1
  Build canonical messaging core, Mongo models, adapters, webhooks, and tests.
- Phase 2
  Ship the unified inbox vertical slice and outbound text messaging.
- Phase 3
  Add business hours, knowledge, canned replies, AI settings, and human handoff.
- Phase 4
  Polish, seed data, simulator support, and documentation hardening.
