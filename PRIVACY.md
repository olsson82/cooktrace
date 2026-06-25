# CookTrace privacy

CookTrace is self-hosted. Your data stays on your server. We (the
maintainers) cannot see it.

## What's stored

- Recipes, pantry items, cook diary, shopping list — in your SQLite
  database (`cooktrace.db`).
- Uploaded recipe images — under `${DATA_UPLOADS_PATH}`.
- User accounts (username, hashed password, optional email + display
  name) — in the same database.
- OIDC SSO links (provider, subject claim) — in the same database.

## What's sent off the server

- **Default install**: nothing.
- **AI assistant** (Phase 5+, opt-in): your prompt + recent recipe/pantry
  context is sent to whichever LLM provider you configured (Anthropic /
  OpenAI / Google / your own Ollama/LM Studio endpoint).
- **NutriTrace federation** (Phase 5+, opt-in): recipe + cook events you
  explicitly link are POSTed to your configured NutriTrace instance.
- **Recipe URL imports**: when you paste a food blog URL, the server
  fetches that page once to scrape its recipe microdata. The blog operator
  sees a request from your server's IP. No data of yours is sent.

## What CookTrace does NOT do

- No telemetry, no analytics, no error reporting to a third party.
- No outbound calls without an explicit user action.
