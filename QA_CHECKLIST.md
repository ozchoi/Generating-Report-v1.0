# QA Checklist v1.5.1

Run the static site through an HTTP server. Export a local backup before testing migration or reset paths.

## Fresh Browser

- Footer shows `App version: v1.5.1`, storage schema v3, and deployment metadata when available.
- Initial title is `Assessment Dashboard / 測驗管理`; no report is selected or rendered.
- Staff must explicitly select the demo student before Prepare Test is enabled.
- Data Management shows the public-source examination security warning.

## Existing v2 Local Storage

- Load `abilityReportCentreSystemV2` data and confirm migration to `abilityReportCentreSystemV3`.
- Confirm `serverDeadline` becomes `deadlineAt`.
- Confirm `answerChangeCount` becomes `answerRevisionCount`.
- Confirm legacy error arrays become primary and secondary error-code fields.
- Confirm report snapshots gain version and finalisation fields.
- If migration fails, confirm old-data export/recovery remains visible and the app does not crash.

## Desktop Chrome

- Navigation is grouped into Primary workflow, Assessment setup, and Utilities.
- Report actions appear only inside a selected report.
- Question Bank and Test Builder actions remain functional.
- No visible button is a silent placeholder.

## iPad-Width Layout

- Check landscape and portrait widths.
- Module groups wrap without overlap.
- Prepare, Begin, answers, question navigation, and marking controls have usable touch targets.
- Marking queue stacks above the selected response panel.

## Explicit Student Selection

- Prepare Test is disabled until a student and test are selected.
- Confirmation names the selected student.
- Student selection clears after submission, cancellation, Begin, or return to dashboard.

## Student Creation and Editing

- In Run Test, `Add New Student / 新增學生` is visible, has a 44px or larger touch target, and opens the staff drawer without a browser prompt.
- Student Name receives focus when the drawer opens; Escape closes the drawer on desktop and returns focus to the triggering action.
- Empty submission displays inline required errors for Student Name, School, Level and Subjects without creating a record.
- Add a student with more than one subject and confirm that its generated `STU-` ID, English and Chinese names, school, level and subject list appear in search results.
- Search by student ID, Chinese name, subject, school, level and contact number; each matching student remains selectable.
- Add the same normalised name, school and level again. Confirm the duplicate warning can select the existing record, return to the form, or explicitly add another record.
- After saving, the new student is selected, Step 3 updates immediately and matching published tests are listed under Recommended while other published tests remain available.
- Edit Student updates school, subjects and the Step 3 confirmation without changing the Student ID or removing assessment records.
- Check the drawer at desktop, iPad landscape and iPad portrait widths; fields and actions remain visible without horizontal scrolling.

## Prepare Versus Begin

- Prepare creates a `Prepared` session with frozen questions.
- `startedAt` and `deadlineAt` remain empty before Begin.
- The cover page shows student, questions, marks, time and instructions.
- Begin changes status to `In progress` and starts the timer once.

## Long Written-Answer Autosave

- Type several sentences with pauses longer than 800 ms.
- Confirm text, focus, cursor position, selection and iPad keyboard remain stable.
- Confirm autosave updates status/progress without replacing the active input.
- Confirm revision count changes on committed revisions, not each keystroke.

## Refresh During Prepared State

- Refresh after Prepare and before Begin.
- Full-screen gate shows `Assessment ready`; the centre dashboard is not exposed.

## Refresh During In Progress

- Answer a question, note time remaining, then refresh.
- Full-screen gate shows `Assessment in progress`.
- Resume preserves the answer and stored `deadlineAt`; the timer does not reset.

## Offline After Test Begins

- Simulate offline after Begin.
- Confirm browser-local autosave continues and no central-storage claim appears.

## Timer Expiry

- Use a short draft test.
- Confirm one automatic submission and the completion screen; repeated submission is blocked.

## Incomplete Submission

- Leave questions unanswered and flag at least one.
- Review shows all unanswered links, all flagged links, actual totals and the response-lock warning.
- Return to Test and Submit and Finish both work.

## Written Marking

- Session queue identifies student, assessment, date, objective status, written progress, score and status.
- Needs review, Marked and All filters select the intended queue.
- Marking points show descriptions, marks, matched evidence and accepted concepts, with internal IDs secondary.
- Suggestions say rule-based match quality; no confidence percentage appears.
- Structured calculation shows method, final value and unit checks; staff final mark remains required.
- Non-full marks require a primary code or explicit No error classification.
- Secondary codes do not add lost marks.
- Continue Marking scrolls to the first unreviewed response.
- Leave Marking Incomplete returns to Assessment Records and preserves `Needs marking`.

## Report Generation

- Needs marking sessions do not change score, topic, difficulty, trend or error evidence.
- No null mark is converted to zero in centre report evidence.
- One assessment uses Baseline Report, Positive Indicators and Possible Priorities wording only.
- Two assessments state that a repeated pattern may be emerging without reporting a trend.
- Three or more comparable, fully marked assessments may report a trend.
- Open Report switches to Reports, updates title, renders the selected snapshot and scrolls to its start.

## Locked Final Report

- Finalise locks the textarea and records version/finalised timestamp.
- Save Draft, Finalise and Revert are hidden for Final versions.
- Create Revised Version creates a new Draft and leaves the original Final unchanged.
- Finalising the revision marks the prior version as superseded.

## Print Preview

- A4 output contains only the body-level `#printRoot` clone of the selected report.
- Centre navigation, setup, marking, utilities and all staff-only buttons are hidden.
- Radar charts are converted to static images; narrative and tables are visible without clipping.
- Print Report and Export PDF remain disabled until a report is selected and then use the same print preparation path.

## Security Warning

- Data Management states that answers and marking logic are public source.
- `SECURITY_LIMITATIONS.md` and `docs/SECURE_BACKEND_PLAN.md` match the prototype boundary.
- No API key, service key or secret is present.

## Hard Refresh After Deployment

- `deployment.json` reports v1.5.1 and the deployed commit SHA.
- CSS and JS use `?v=1.5.1`.
- Hard refresh loads the same version shown in the footer.

## Button Inventory

For every row, record `Works`, `Disabled with reason`, or `Not applicable`.

| Button or control | Expected result | Result |
| --- | --- | --- |
| Module navigation | Opens the selected module only | |
| Dashboard quick actions | Opens the requested workflow module | |
| Student selection | Explicitly selects one student | |
| Add New Student | Opens the accessible student form | |
| Add Student / Save Changes | Validates, persists and selects the record | |
| Duplicate student actions | Uses existing record, returns to form or explicitly adds anyway | |
| Edit Student | Updates supported student fields without changing ID | |
| Test selection | Selects a published assessment | |
| Prepare Test | Creates Prepared session without timer | |
| Begin Test | Starts timer and first question | |
| Resume Assessment | Restores in-progress state and deadline | |
| Cancel Existing Assessment | Cancels after confirmation | |
| Start Separate New Assessment | Requires explicit confirmation | |
| Previous / Next | Disabled at first/final question | |
| Flag Question | Toggles visible flagged state | |
| Submit Test | Opens complete review dialog | |
| Return to Test | Closes review without submission | |
| Submit and Finish | Saves once and locks responses | |
| Return to Dashboard | Requires three-second hold | |
| Marking filters / queue | Selects a visible assessment | |
| Use Suggested Mark | Applies rule-based suggestion for staff review | |
| Save and Next | Validates classification, saves and advances | |
| Finish Marking | Finishes or shows distinct incomplete actions | |
| Generate Report | Enabled only when every response has a final mark | |
| Open Report | Opens selected version in Reports | |
| Save Draft / Finalise | Persists or locks a Draft | |
| Create Revised Version | Clones Final as next Draft version | |
| Print / Export | Uses selected report only | |
| Question Bank actions | Preview, duplicate, add and analytics work | |
| Test Builder actions | Create, edit, preview, validate and publish work | |
| Import Existing Results | Imports or shows dependency error | |
| Export / Import Local Backup | Preserves canonical v3 state | |
| Reset Demo Data | Warns to back up and requires confirmation | |
