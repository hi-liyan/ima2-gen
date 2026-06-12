# OpenAI Base URL Design

## Goal

Add support for a custom OpenAI `baseUrl` plus API key flow for the existing `provider: "api"` path.

Scope is intentionally narrow:

- Support only OpenAI official API semantics behind a proxy or relay domain.
- Do not support OpenRouter, Azure OpenAI, or other OpenAI-compatible but non-identical providers.
- Preserve the existing provider model and keep `provider: "api"` as the single OpenAI API-key mode.

## Problem Statement

The current API-key provider only supports:

- OpenAI API key storage and validation
- A runtime `OpenAI` client created with `new OpenAI({ apiKey })`
- Requests targeting the SDK default API host

This prevents users from routing official OpenAI traffic through a proxy, relay, or internal gateway domain while continuing to use standard OpenAI request and response semantics.

## Non-Goals

- No new provider type such as `api-proxy`
- No per-request or per-session endpoint switching
- No support for provider-specific auth schemes beyond `Authorization: Bearer sk-*`
- No support for endpoint families that require different paths, headers, or billing semantics

## Recommended Approach

Keep `provider: "api"` unchanged at the product level and add one optional global configuration value:

- `openaiBaseUrl`

When unset, the app continues using the official default:

- `https://api.openai.com/v1`

When set, the app uses that configured base URL for all `provider: "api"` OpenAI SDK traffic.

This keeps the surface area small and avoids duplicating the existing `api` provider behavior across generate, edit, multimode, node, and agent flows.

## Configuration Model

### New Config Value

Add `apiProvider.baseUrl` in the runtime config model.

Sources:

- Environment variable: `IMA2_OPENAI_BASE_URL`
- `config.json`: `apiProvider.baseUrl`
- Built-in default: `https://api.openai.com/v1`

Priority:

1. Environment variable
2. `config.json`
3. Built-in default

### Normalization Rules

Introduce a small normalization helper dedicated to OpenAI proxy URLs.

Rules:

- Allow only `http:` or `https:`
- Reject empty host
- Reject query string and fragment
- Remove trailing `/`
- If pathname is empty, normalize to `/v1`
- If pathname is `/`, normalize to `/v1`
- If pathname is already `/v1`, keep it
- Reject other pathnames to avoid ambiguous or partially compatible endpoints

This intentionally keeps the accepted shape narrow because the feature is only meant for OpenAI official protocol relays.

## Runtime Changes

### Runtime Context

Extend `RuntimeContext` with:

- `openaiBaseUrl: string`
- `openaiBaseUrlSource: "env" | "config" | "default"`

These values are used for:

- client construction
- settings UI state
- provider status reporting

### OpenAI Client Creation

Replace the current OpenAI SDK construction:

- `new OpenAI({ apiKey })`

with:

- `new OpenAI({ apiKey, baseURL: openaiBaseUrl })`

This applies at:

- server startup
- hot reload after settings updates

### Startup Loading

Add a loader alongside the existing API-key loader in `server.ts`:

- `loadOpenAIBaseUrl()`

It should read from:

- env
- config file
- default

and always return a normalized value plus a source marker.

## API Design

Do not overload `PUT /api/keys/openai` with endpoint settings. Keep API-key routes focused on keys.

Add a dedicated OpenAI provider config surface:

- `GET /api/providers/openai/config`
- `PUT /api/providers/openai/config`
- `DELETE /api/providers/openai/config/base-url`

### `GET /api/providers/openai/config`

Returns:

- normalized `baseUrl`
- `source`
- `isDefault`
- key configuration state summary if needed by the UI

### `PUT /api/providers/openai/config`

Accepted fields:

- `baseUrl?: string`

Behavior:

- normalize and validate format
- persist to `config.json` when not env-sourced
- if an API key is already available at runtime, validate the endpoint with a lightweight upstream request
- rebuild `ctx.openai` on success

Validation behavior:

- If no API key exists yet, only perform structural URL validation
- If an API key exists, also perform online validation with `GET {baseUrl}/models`

This keeps setup usable in either order while still protecting users from saving a dead endpoint once credentials exist.

### `DELETE /api/providers/openai/config/base-url`

Behavior:

- reject deletion when the source is `env`
- remove `apiProvider.baseUrl` from `config.json`
- revert runtime to the built-in default OpenAI URL
- rebuild `ctx.openai`

## Existing Key Route Interaction

The existing OpenAI key route remains responsible for:

- key save
- key delete
- key validation

It should be updated so that when a key is saved and a custom `openaiBaseUrl` is already active, the runtime OpenAI client is rebuilt with both values:

- `apiKey`
- `baseURL`

Key validation should also use the active OpenAI base URL instead of assuming the official host whenever a custom proxy is configured.

## Frontend Design

### Settings Surface

Extend the OpenAI settings section rather than adding a new provider card.

The OpenAI API configuration block should contain:

- existing API key input
- new Base URL input
- source indicator for both key and base URL
- save action
- remove custom base URL action when config-sourced

### UX Rules

- Show the default endpoint as guidance: `https://api.openai.com/v1`
- Explain that only OpenAI official protocol relays are supported
- Treat empty input as “use default”
- If the base URL source is `env`, render it read-only
- Saving should immediately refresh settings state

### UI Component Shape

The current `ApiKeyInput` component is too narrow for this feature.

Recommended change:

- refactor it into an OpenAI-specific settings form or a small reusable credential-plus-endpoint form

The UI should avoid splitting key and endpoint across unrelated cards because they form one runtime configuration.

## Health and Status Reporting

Update provider and health responses to expose the active OpenAI endpoint metadata needed by the UI and diagnostics.

Add fields such as:

- `openaiBaseUrl`
- `openaiBaseUrlSource`
- `openaiCustomBaseUrl`

The actual full URL can be returned in authenticated local app responses because this is a local studio, but it should only be surfaced where it is operationally useful.

## Billing Behavior

`/api/billing` should continue using the official OpenAI billing endpoints, not the custom proxy host.

Reasoning:

- billing semantics belong to the OpenAI account, not the relay
- many relays will not proxy private billing endpoints
- this avoids accidental regression in existing billing behavior

This is an intentional asymmetry:

- generation traffic follows `openaiBaseUrl`
- billing traffic remains on official OpenAI hosts

## Error Handling

Add stable validation failures for:

- invalid URL scheme
- missing host
- unsupported pathname
- query string present
- fragment present
- env-sourced value cannot be deleted or overwritten from UI
- endpoint validation failure

Errors should stay provider-oriented and user-readable, while retaining stable machine codes for tests.

## Testing Strategy

Add coverage for:

1. Config loading
   - default OpenAI base URL is used when unset
   - env overrides config
   - config overrides default

2. URL normalization
   - bare host normalizes to `/v1`
   - `/v1` is accepted
   - trailing slash is removed
   - unsupported paths are rejected
   - query and fragment are rejected

3. Runtime behavior
   - startup client uses configured base URL
   - saving a custom base URL hot-rebuilds the runtime client
   - deleting a config-sourced base URL reverts to the default

4. API provider behavior
   - `provider=api` generation requests use the active custom base URL
   - key validation uses the active base URL when configured

5. UI and status behavior
   - provider config route returns source and normalized value
   - env-sourced base URL is read-only in the UI state model

## Rollout Notes

This change is safe to roll out behind the existing `api` provider because:

- default behavior is unchanged
- custom base URL is opt-in
- unsupported endpoint families are explicitly out of scope

No migration is required for existing users.

## Open Questions Resolved

### Should this be a new provider?

No. That would create duplicate provider logic with little product benefit.

### Should billing follow the custom endpoint?

No. Billing remains pinned to official OpenAI endpoints.

### Should arbitrary OpenAI-compatible APIs be supported?

No. The design only supports official OpenAI protocol relays with the standard `/v1` path model.
