## Plan: Audience-Discovery Workflow

Create a new workflow in workflows/audience-discovery that mirrors the structure of business-insights, using the same context inputs (assets + company answers + optional transcripts) and a transcript correction step after the final prompt. Add the corresponding API route and unit tests by copying patterns from business-insights, while keeping prompt loading generic via `getWorkflowPrompts` and avoiding any direct .md reads under milton/. This keeps orchestration, validation, and QA consistent with existing conventions and makes the new workflow testable and deterministic.

**Steps**
1. Scaffold the new workflow folder structure in workflows/audience-discovery to match workflows/business-insights: add `config.ts`, `workflow.ts`, `steps/index.ts`, `steps/context.ts`, `steps/qa.ts`, `steps/validation.ts`.
2. Implement config constants and path helpers in workflows/audience-discovery/config.ts, mirroring workflows/business-insights/config.ts with `WORKFLOW_NAME = 'audience-discovery'` and `getCompanyAnswersDir()` / `getCompanyTranscriptsDir()`.
3. Implement context and validation steps by adapting the logic from workflows/business-insights/steps and reusing shared helpers in workflows/shared/steps; keep validation aligned with the “same inputs” decision.
4. Implement the workflow orchestrator in workflows/audience-discovery/workflow.ts following workflows/business-insights/workflow.ts, with transcript correction executed after the final prompt when transcript context exists.
5. Add the API route in app/api/workflow/audience-discovery/route.ts by copying app/api/workflow/business-insights/route.ts, preserving the TODO comment block and calling `start(audienceDiscoveryWorkflow, [companyName])`.
6. Add tests mirroring workflows/business-insights/__tests__/workflow.test.ts and the step tests in workflows/business-insights/steps/__tests__, adjusting for the new workflow name and the “correction after last prompt” behavior.

**Verification**
- Run `pnpm test -- workflows/audience-discovery` and the new API route test(s) once added.
- Optional: `pnpm test -- workflows/business-insights` to ensure no regressions from shared logic changes.

**Decisions**
- Use the same context inputs as business-insights (assets + answers + optional transcripts).
- Run transcript correction after the last prompt instead of a fixed step number.
