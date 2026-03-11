# Milton Runner (`milton-runner`) Orchestrator Plan

## Goal
Introduce a new orchestrator workflow named `milton-runner` that awaits the
existing `audience-discovery` and `business-insights` workflows, then passes
both outputs into `strategic-relationship-creation` as a single object.

## Scope
- Create a new workflow: `workflows/milton-runner/`
- Add API route for `milton-runner`
- Add tests for the orchestrator workflow

## Proposed Changes (Ordered)

### 1) Define the Orchestrator Workflow
- Create `workflows/milton-runner/config.ts` and `workflow.ts`.
- `workflow.ts` should:
  - `await audienceDiscoveryWorkflow(companyName)`
  - `await businessInsightsWorkflow(companyName)`
  - `await strategicRelationshipCreationWorkflow({ companyName, audience: { output: audienceOutput }, business: { output: businessOutput } })`
  - return the final output.
- Note: current child workflows return only `output`. The strategic workflow
  expects an object where `audience` and `business` each expose an `output`
  property, as shown above.

### 2) Expose API Route
- Add `app/api/workflow/milton-runner/route.ts`.
- Input: `{ companyName: string }`
- Response: `{ runId }`
- Use JSON parsing with `try/catch` (as in the audience-discovery route).

### 3) Tests
- Add `workflows/milton-runner/__tests__/workflow.test.ts`.
- Cover:
  - sequential awaits (audience -> business -> strategic)
  - correct payload to `strategic-relationship-creation` (includes `companyName`)
  - final output passthrough

## Notes
- Direct `await` is recommended for workflow composition when the parent needs
  the child outputs and a unified event log.
