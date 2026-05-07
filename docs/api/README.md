# BetTrack API Documentation

This folder contains OpenAPI 3.1 specifications and reference documentation for all BetTrack API surfaces.

## API Surfaces

### Internal REST API (Dashboard Backend)

The dashboard backend exposes a RESTful API at `http(s)://<host>:3001`. All routes are prefixed with `/api`.

**Spec file:** [`openapi-internal.yaml`](openapi-internal.yaml)

| Route Group | Base Path | Auth | Description |
|---|---|---|---|
| Health | `GET /health` | None | Service health check |
| Auth | `/api/auth` | None / Session | OAuth2 login, logout, status |
| Games | `/api/games` | Session | Browse games and odds |
| Bets | `/api/bets` | Session | Manage bets, settle, stats |
| Futures | `/api/futures` | Session | Futures market listings |
| Stats | `/api/stats` | Session | Team, player, game stats |
| CLV Analytics | `/api/analytics/clv` | Session | Closing Line Value reports |
| API Keys | `/api/keys` | Session | Generate and manage API keys |
| Admin | `/api/admin` | Admin Session | Data sync, site config, DB stats |
| MCP Integration | `/api/mcp` | API Key (`sk_`) | Optimized routes for MCP server |
| AI Bets | `/api/ai/bets` | API Key (`sk_`) | AI-created bet submission |

### External MCP API

The MCP Server provides Claude Desktop with 30+ tools for querying live sports data and odds. It is not a traditional REST API — it uses the Model Context Protocol (MCP) over stdio.

**Spec file:** [`openapi-external.yaml`](openapi-external.yaml)

The external spec documents the HTTP endpoints that the MCP server calls internally through the BetTrack backend (`/api/mcp/*`), enabling external tooling and integration testing.

## Authentication

### Session Auth (Dashboard routes)

Most dashboard routes require a valid session. Authentication mode is set via `AUTH_MODE` in the backend environment:

- **`none`** — Standalone mode; all routes are accessible without login (default).
- **`oauth2`** — Requires login via Google or Microsoft OAuth before accessing protected routes.

### API Key Auth (MCP / AI routes)

MCP integration and AI routes use API key Bearer tokens:

```http
Authorization: Bearer sk_<your-api-key>
```

Keys are generated at `POST /api/keys` and stored with SHA-256 hashes. Only the full key is returned at creation time.

### Admin Auth

Admin routes (`/api/admin/*`) require an authenticated session with `isAdmin: true`. This applies regardless of `AUTH_MODE` — even in `none` mode, admin routes check for a real session.

## Error Responses

All API errors follow a consistent envelope format:

```json
{
  "status": "error",
  "message": "Human-readable description",
  "error": "Optional technical detail"
}
```

Standard HTTP status codes apply: `400` Bad Request, `401` Unauthorized, `403` Forbidden, `404` Not Found, `500` Internal Server Error, `503` Service Unavailable.

## Viewing the Specs

These YAML files follow the OpenAPI 3.1 standard. You can render them using:

- **[Swagger UI](https://swagger.io/tools/swagger-ui/)** — Paste the raw YAML into the editor at `https://editor.swagger.io`
- **[Stoplight Studio](https://stoplight.io/studio)** — Import as a local file for full editing support
- **VS Code** — Install the [OpenAPI (Swagger) Editor](https://marketplace.visualstudio.com/items?itemName=42Crunch.vscode-openapi) extension

## Versioning

The API version tracks the dashboard backend package version. Check `dashboard/backend/package.json` for the current version.

Current backend version: `0.2.11`
