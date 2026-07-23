# Secure Backend Plan

The production design can preserve the centre-operated workflow without adding student accounts.

## Proposed boundary

1. Centre staff authenticate to a centre workspace and prepare an assessment for a selected student.
2. The server creates a short-lived centre-device session token and returns only the public student question payload.
3. Correct answers, option correctness, marking points, and marking rules remain server-side.
4. The server creates and enforces the assessment deadline using server time.
5. Student responses autosave through the device session token to a central database.
6. Submission locks responses and invokes a private marking endpoint for objective questions.
7. Staff review written responses through centre-controlled access.
8. Final marks, report evidence, and immutable report snapshots persist centrally.

## Suggested services

- Public student question endpoint: accepts a short-lived assessment token and returns stems, options, input types, marks, and section order only.
- Private marking endpoint: evaluates objective responses against server-side answer keys and records an audit event.
- Staff assessment API: prepares, cancels, resumes, marks, and reports under centre-controlled access.
- Central database: stores students, templates, frozen question versions, sessions, responses, marks, and report versions.
- Server deadline service: issues `startedAt` and `deadlineAt`; clients display remaining time but do not authoritatively set it.
- Backup and audit: provides encrypted backups, retention controls, and a history of mark and report changes.

## Access model

Students do not need accounts. Centre staff authenticate once, prepare the assessment, and hand over a device carrying a restricted short-lived session token. The token must expose no staff routes and expire after submission or cancellation.

## Migration path

Keep the current `getStudentQuestionPayload()`, `getStaffMarkingData()`, and `markObjectiveResponse()` interface. Replace `DemoLocalAnswerProvider` with a backend provider, then move persistence from `localStorage` to the central API. Do not publish answer keys in a separate JSON asset; that remains public source.
