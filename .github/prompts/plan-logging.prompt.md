## Plan: Centralized Logging Rollout

We will standardize on Pino, add a shared logger wrapper for each runtime (server and browser), and replace all `console` calls with corresponding wrapper. The logger will be configured via `LOG_LEVEL` (and `LOG_PRETTY` in dev) with environment-based defaults for dev vs prod. We will update project documentation in README.md, AGENTS.md, and .github/copilot-instructions.md to describe usage, configuration, and future integration guidance. This plan targets the current console usage in workflows and UI, while leaving room for external log management later via Pino transports.

**Steps**
1. Add Pino dependencies and a shared logger wrapper per runtime (server and browser) in [lib](lib) (e.g., `lib/logger.ts` and `lib/logger.browser.ts`) with `LOG_LEVEL` and `LOG_PRETTY` support.
2. Replace `console.log`/`console.warn`/`console.error` with the logger in:
   - [workflows/shared/steps/prompts.ts](workflows/shared/steps/prompts.ts#L7-L28)
   - [workflows/business-insights/steps/validation.ts](workflows/business-insights/steps/validation.ts#L85-L133)
   - [app/page.tsx](app/page.tsx#L41-L53)
3. Ensure dev vs prod behavior: pretty formatting in dev (optional via `LOG_PRETTY`), structured JSON in prod, and browser-safe logging without direct `console` usage.
4. Document usage/config and future log management integration guidance in:
   - [README.md](README.md)
   - [AGENTS.md](AGENTS.md)
   - [.github/copilot-instructions.md](.github/copilot-instructions.md)

**Verification**
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

**Decisions**
- Logging library: Pino
- Config: `LOG_LEVEL` (+ `LOG_PRETTY` in dev)
- Docs: README.md + AGENTS.md + .github/copilot-instructions.md
- Client logging: dedicated logger wrapper for frontend
