# API Contracts

## Conventions

- Base API URL: `http://localhost:4000`
- JSON request and response bodies
- IDs are Mongo object IDs unless otherwise stated
- All inbox UI APIs use canonical models, never raw provider payloads

## Webhook Endpoints

### `POST /webhooks/facebook`

Receives Messenger webhook events.

Request body:

```json
{
  "object": "page",
  "entry": [
    {
      "id": "facebook-page-id",
      "messaging": []
    }
  ]
}
```

Responses:

- `200` webhook processed
- `400` invalid payload
- `404` matching channel connection not found

### `GET /webhooks/facebook`

Handles the Meta webhook challenge on the actual callback URL.

### `GET /webhooks/facebook/verify`

Handles Messenger verification.

Query:

- `hub.mode`
- `hub.verify_token`
- `hub.challenge`

Responses:

- `200` returns challenge
- `403` verification failed

### `POST /webhooks/telegram`

Receives Telegram updates. The server resolves the bot connection by configured webhook secret.

Headers:

- `x-telegram-bot-api-secret-token`

Responses:

- `200` processed
- `403` secret mismatch
- `404` connection not found

### `POST /webhooks/viber`

Receives Viber callbacks. In MVP the connection is resolved either by explicit webhook key or by single active Viber connection.

Responses:

- `200` processed
- `404` connection not found
- `409` ambiguous active Viber configuration

### `POST /webhooks/tiktok`

Scaffold endpoint only. TikTok business messaging support is not marked complete.

Responses:

- `501` not implemented for production use

## Internal APIs

### `GET /api/conversations`

Query params:

- `workspaceId` required
- `status` optional
- `channel` optional
- `assigneeUserId` optional
- `search` optional

Response:

```json
{
  "items": [
    {
      "_id": "conversationId",
      "workspaceId": "workspaceId",
      "channel": "telegram",
      "channelAccountId": "bot-1",
      "externalChatId": "12345",
      "externalUserId": "999",
      "contactId": "contactId",
      "status": "open",
      "unreadCount": 2,
      "lastMessageAt": "2026-03-12T10:00:00.000Z",
      "lastMessageText": "Do you have this in blue?",
      "aiEnabled": true,
      "aiState": "idle",
      "tags": []
    }
  ]
}
```

### `GET /api/conversations/:id/messages`

Response:

```json
{
  "items": [
    {
      "_id": "messageId",
      "conversationId": "conversationId",
      "channel": "facebook",
      "direction": "inbound",
      "senderType": "customer",
      "kind": "text",
      "text": {
        "body": "Hi"
      },
      "status": "received",
      "delivery": null,
      "createdAt": "2026-03-12T10:00:00.000Z"
    }
  ]
}
```

### `GET /api/conversations/:id`

Returns the conversation plus its linked contact when available.

### `POST /api/conversations/:id/messages`

Creates an outbound canonical message command.

Request:

```json
{
  "senderType": "agent",
  "kind": "text",
  "text": {
    "body": "Thanks, we have it in stock."
  },
  "meta": {
    "source": "inbox"
  }
}
```

Response:

```json
{
  "message": {
    "_id": "messageId",
    "status": "sent"
  },
  "delivery": {
    "status": "sent",
    "externalMessageId": "provider-id"
  }
}
```

### `PATCH /api/conversations/:id`

Allowed fields:

- `status`
- `assigneeUserId`
- `aiEnabled`
- `aiState`
- `tags`

### `GET /api/contacts/:id`

Returns a canonical contact with channel identities and linked conversation count.

### `GET /api/channels`

Returns configured channel connections for a workspace.

### `POST /api/channels/:channel/connect`

Creates or updates a `channel_connection` using real provider validation when available.

Request shape:

```json
{
  "workspaceId": "workspaceId",
  "displayName": "Main Telegram Bot",
  "credentials": {
    "botToken": "token",
    "webhookSecret": "secret"
  },
  "webhookConfig": {}
}
```

Response connection fields include:

- `status`
- `webhookUrl`
- `webhookVerified`
- `verificationState`
- `lastInboundAt`
- `lastOutboundAt`
- `lastError`

Credentials are redacted in list and connect responses.

### `POST /api/channels/:channel/test`

Runs provider validation without persisting the connection.

### `GET /api/knowledge`

Lists knowledge items for a workspace.

### `POST /api/knowledge`

Creates a knowledge item.

### `PATCH /api/knowledge/:id`

Updates a knowledge item.

### `DELETE /api/knowledge/:id`

Deletes a knowledge item.

### `GET /api/canned-replies`

Lists canned replies.

### `POST /api/canned-replies`

Creates a canned reply.

### `PATCH /api/canned-replies/:id`

Updates a canned reply.

### `DELETE /api/canned-replies/:id`

Deletes a canned reply.

### `GET /api/ai-settings`

Returns workspace AI settings.

### `PATCH /api/ai-settings`

Updates workspace AI settings.

### `GET /api/automations`

Returns business hours and rule configuration.

### `PATCH /api/automations`

Updates automation rules and business hours.

### `GET /api/audit-logs`

Lists recent audit log entries for AI decisions and automation actions.

Query params:

- `workspaceId` required
- `conversationId` optional
- `eventType` optional
- `limit` optional

## Error Contract

Typical error response:

```json
{
  "error": {
    "code": "CHANNEL_CAPABILITY_BLOCKED",
    "message": "Channel telegram does not support outbound kind image in the current adapter."
  }
}
```

## Delivery and Status Semantics

- `received`
  Inbound message accepted and stored.
- `queued`
  Outbound message accepted for send attempt.
- `sent`
  Provider send API accepted the message.
- `delivered`
  Delivery callback confirmed provider delivery.
- `read`
  Read receipt confirmed.
- `failed`
  Send attempt failed or provider rejected the message.

## Notes

- TikTok remains scaffold-only until public messaging support is verified.
- Unsupported provider content maps to canonical `unsupported`.
- Raw provider payloads remain available in storage and admin/debug tooling, not as the primary UI data source.
- No provider connection means no outbound send.
- No verified webhook means no claim of a live inbound inbox.
- No model-generated response means no `ai` sender label.
