# Strategic Relationship Creation (`strategic-relationship-creation`) Plan

## Goal
Evolve the existing `strategic-relationship-creation` workflow to accept the
outputs from `audience-discovery` and `business-insights` as a single object,
using only those outputs as the basis for prompt execution.

## Scope
- Update `strategic-relationship-creation` input shape
- Adjust its workflow logic to use the new input
- Update tests for the workflow

## Proposed Changes (Ordered)

### 1) Update Workflow Signature
- Change `strategicRelationshipCreationWorkflow` to accept a single object:
  - `audience: { output: string; context: ModelMessage[] }`
  - `business: { output: string; context: ModelMessage[] }`
- Remove `companyName` from its inputs.

### 2) Update Context Construction
- Build separate, asset-like context messages for each prior workflow:
  - Include only the output from each prior workflow.
  - Tag each message (e.g. `tag:previous-workflow-output`) so the LLM knows
    it is prior workflow output.
- Seed `contextMessages` with these tagged asset-like messages.
- Keep existing prompt execution loop.

### 3) Tests
- Update `workflows/strategic-relationship-creation/__tests__/workflow.test.ts`:
  - Use the new input object
  - Ensure prompt flow works with output-only context

## Notes
- Validation placeholders can remain as-is until required filenames are defined.
