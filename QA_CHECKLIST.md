# QA Checklist v1.4.1

Use the static site through an HTTP server. Do not open `index.html` directly for final QA.

## Fresh Browser

- Confirm footer shows `App version: v1.4.1`, storage schema v2, and deployment metadata when available.
- Confirm privacy warning appears in Data Management.
- Confirm centre workflow is the primary interface and legacy import sidebar is hidden.
- Complete workflow: select demo student -> select Chemistry test -> start Test Mode -> answer questions -> submit -> mark written answers -> generate report -> save edited report -> print.

## Existing v1 Local Storage

- Load with old `abilityReportCentreSystemV1` data.
- Expected: migration to v2 or visible recovery message.
- Confirm the page does not crash.
- Export old/local backup before reset where needed.

## Desktop Chrome

- Check module navigation.
- Check Question Bank actions: Preview, Duplicate, Add to Test, View Results.
- Check Test Builder: create, edit, add section, add question, move up/down, move between sections, remove, preview test, preview mark scheme, publish, duplicate.
- Check visible disabled controls have disabled styling and reason text.

## iPad-Width Layout

- Check dashboard modules wrap cleanly.
- Check Test Mode question navigation, answer controls, and submit review dialog.
- Check Test Builder controls stack without clipping.

## Offline After Test Begins

- Start a test, then simulate offline.
- Answer several questions.
- Expected: local autosave continues in this browser; no external storage claim is shown.

## Page Refresh During Test

- Start a test, answer questions, refresh.
- Expected: unfinished session appears with Resume / Cancel options.

## Timer Expiry

- Use a short draft test time limit.
- Expected: auto-submit, objective marking, and completion screen.

## Incomplete Submission

- Leave some questions unanswered and flag one.
- Expected: submit review dialog shows Answered, Unanswered, Flagged, Time remaining, and jump buttons.

## Written Marking

- Confirm Generate Report is disabled before all written answers are reviewed.
- Use Approve Suggestion and Save and Next.
- Select multiple error codes.
- Try Finish Marking early; expected incomplete warning with Continue Marking and Cancel.

## Report Generation

- Generate report after marking.
- Open Report from session table.
- Confirm Reports module opens, report metadata appears, charts/tables update, and summary scrolls into view.
- Edit narrative, refresh, and confirm edits persist.

## Print Preview

- Confirm only `#printableReport` prints.
- Confirm centre controls, upload/import panels, Test Builder, Question Bank, sessions, and staff buttons are hidden.
- Confirm A4 output has no clipped tables and print radars are visible.

## Hard Refresh After Deployment

- Confirm `deployment.json` loads.
- Confirm footer SHA matches the latest deployed commit.
- Confirm CSS and JS use `?v=1.4.1`.

## Button Inventory

| Button or control | Expected result | Works | Disabled with reason | Not applicable |
| --- | --- | --- | --- | --- |
| Module navigation | Opens selected module only |  |  |  |
| Dashboard quick actions | Jump to target module |  |  |  |
| Student search result | Selects student |  |  |  |
| Test selection | Selects published test |  |  |  |
| Start Test | Starts or shows duplicate-session guard |  |  |  |
| Resume Test | Opens in-progress session |  |  |  |
| Cancel Session | Cancels with confirmation |  |  |  |
| Question Preview | Opens staff preview drawer |  |  |  |
| Duplicate Question | Creates draft copy |  |  |  |
| Add to Test | Adds to editable draft or creates one |  |  |  |
| View Results | Opens analytics or empty-state drawer |  |  |  |
| Create New Test | Creates draft test |  |  |  |
| Duplicate Test | Creates editable draft copy |  |  |  |
| Save Draft | Persists draft changes |  |  |  |
| Add Section | Adds section to draft |  |  |  |
| Add Selected Question | Adds selected bank question |  |  |  |
| Move Up / Down | Reorders question |  |  |  |
| Move section selector | Moves question between sections |  |  |  |
| Remove Question | Removes question from draft |  |  |  |
| Preview Student Test | Opens read-only student preview |  |  |  |
| Preview Mark Scheme | Opens staff mark scheme |  |  |  |
| Publish | Publishes only when validation passes |  |  |  |
| Previous | Disabled on first question |  |  |  |
| Next | Disabled on final question |  |  |  |
| Flag Question | Toggles Question Flagged text |  |  |  |
| Submit Test | Opens in-page review dialog |  |  |  |
| Submit review jump | Returns to unanswered/flagged question |  |  |  |
| Confirm Submit | Submits once only |  |  |  |
| Return to Dashboard | Requires 3-second hold |  |  |  |
| Approve Suggestion | Saves suggested mark |  |  |  |
| Save and Next | Saves mark, feedback, codes and scrolls next |  |  |  |
| Finish Marking | Blocks incomplete marking visibly |  |  |  |
| Generate Report | Disabled until written marking complete |  |  |  |
| Open Report | Opens Reports module and selected snapshot |  |  |  |
| Save Draft report | Persists edited narrative |  |  |  |
| Finalise Report | Marks report final |  |  |  |
| Revert Report | Restores generated narrative with confirmation |  |  |  |
| Print Report | Prints report wrapper only |  |  |  |
| Export PDF | Opens print dialog for Save as PDF |  |  |  |
| Export Text | Downloads report text |  |  |  |
| Import Existing Results upload controls | Loads CSV/XLSX or shows dependency error |  |  |  |
| Export Local Backup | Downloads JSON backup |  |  |  |
| Import Local Backup | Validates and imports JSON backup |  |  |  |
| Reset Demo Data | Resets after confirmation |  |  |  |
