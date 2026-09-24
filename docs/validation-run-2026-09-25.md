# 2026-09-25 Validation Run

This is the evidence source for a future portfolio `07 / VALIDATION` section. It records actual browser walkthroughs of the current Demo, not a list of controls that happen to be clickable.

## Environment and Boundaries

- Local preview: `http://127.0.0.1:4174/`
- Browser: Chrome, mobile viewport `430 x 932`
- Method: Playwright walkthroughs with fresh local storage per scenario
- Scope: controlled Demo logic and local persistence only
- Not claimed: external LLM quality, truth of user statements or materials, arbitrary code execution, real project completion

## A. Core Path Validation — 5 / 5

| ID | Scenario | Expected behavior | Result | Browser evidence |
| --- | --- | --- | --- | --- |
| VAL-001 | First-time user selects `转 AI 产品 / AI PM` | Homepage prioritizes a PM-oriented practice recommendation while all five main modules remain reachable. | PASS | Goal selection showed the PM recommendation; navigation remained available. |
| VAL-002 | User asks `什么是 RAG？` | Homepage answers directly, then provides quiz and save actions that form a learning record. | PASS | Answer → three-question quiz → one learning record in My. |
| VAL-003 | User enters `我想学 AI，但不知道从哪开始` | Homepage asks for the immediate learning need before recommending a next step. | PASS | Conversation displayed `你现在更想先解决哪类问题？`; no large course plan was returned. |
| VAL-004 | User pastes a conditional function | Homepage explains overall role first; training is generated from that function and can be completed into a code record. | PASS | Generated training used pasted function name; five-step flow saved a code understanding record. |
| VAL-005 | User completes a projectized practice case | Practice accepts three submitted task outputs, checks each, and saves an explicitly labelled personal training case. | PASS | Completed case persisted after reload and remained separate from real-experience expression. |

## B. Key Counterexample Validation — 5 / 5

| ID | Risk scenario | Required guardrail | Result | Browser evidence |
| --- | --- | --- | --- | --- |
| BC-001 | User requests `写厉害点` | Do not save the request as an experience claim; ask for concrete responsibility, deliverable, result, or material description. | PASS | Warning appeared and flow stayed on `职责范围`. |
| BC-002 | User enters the Code module without pasted code | Do not fabricate a homepage-derived training session. | PASS | Current-training area displayed the empty state, not a generated session. |
| BC-003 | User submits `不知道` in a practice task | Reject insufficient output while preserving the field for revision. | PASS | Task feedback required more detail; user then revised and continued. |
| BC-004 | User states they `主导` all work without adequate scope | Mark the related candidate claim high-risk and block approval. | PASS | High-risk label shown; approval action disabled. |
| BC-005 | User reaches code step 5 | Do not expose internal condition/parameter/return terms or imply code execution. | PASS | Step used plain-language choices only and explicitly said it does not run or validate code. |

## C. State, Asset, and Continuity Validation — 5 / 5

| ID | State scenario | Required behavior | Result | Browser evidence |
| --- | --- | --- | --- | --- |
| ST-001 | User saves a learning record, deletes it, undoes deletion, then refreshes | Confirmation, undo, and restored state survive refresh. | PASS | Record disappeared after confirmation, returned after undo, and remained after reload. |
| ST-002 | User completes code training and saves a record | The user’s understanding summary and record survive refresh. | PASS | `decide · 代码理解` record remained after reload. |
| ST-003 | User completes practice | Personal training case survives refresh. | PASS | Training-case asset was visible after reload. |
| ST-004 | User approves claims, accepts declaration, saves candidate expression | Saved version freezes source claims and remains reviewable after refresh. | PASS | Version screen showed `来源快照已冻结` and `关联主张快照`. |
| ST-005 | User saves `补代码理解` as current goal | Goal preference survives refresh but does not lock access to Portfolio. | PASS | Homepage preserved the code goal after reload; Portfolio remained reachable. |

## Product Findings Used in This Run

1. The original step-5 screen was too tall and exposed internal code language. It was changed during this run to a compact final-step strip, three dropdowns, and an editable `理解摘要卡`.
2. The experience-expression flow originally accepted `写厉害点` as ordinary content. It now intercepts the phrase before anything is saved.
3. Portfolio behavior is validated as expression-boundary behavior only. The run does not claim to validate the truth or quality of user-supplied materials.

## Portfolio-safe Wording

Use this run only to support the following claim:

> I used scenario-based browser validation to check core flows, counterexamples, and state continuity in a controlled Demo. The validation focused on interaction behavior, product boundaries, and local persistence.

Do not claim that the product verifies external materials, runs arbitrary user code, or certifies real project completion.

## Next Regression Rule

Re-run all 15 cases after changes to homepage routing, code training, practice feedback, expression claims, navigation, or local persistence.
