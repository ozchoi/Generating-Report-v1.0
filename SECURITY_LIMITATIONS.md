# Security Limitations

This repository is a public static prototype. It is suitable for demonstrations and centre workflow evaluation, not secure examinations or confidential student records.

## Public source visibility

GitHub Pages serves the HTML, CSS, and JavaScript source to every visitor. The demo question bank, correct answers, option flags, marking points, and local marking rules can be inspected in the browser. Excluding those fields from the normal Test Mode payload prevents accidental display in the interface; it does not make the answer key secret.

## Browser-only storage

Assessment records are stored in `localStorage` on one browser and device. They are not encrypted, centrally backed up, synchronised, access-controlled, or protected from someone who can inspect or clear browser data. Do not enter real confidential student information in the public deployment.

## Device time

Timed assessments use a deadline stored against the device clock. Changing the device time or browser data can affect this prototype mechanism. It is not a server-controlled examination timer.

## Access and continuity

The prototype has no secure staff authentication, no student accounts, no central audit service, no cross-device recovery, and no guaranteed backup. The three-second device guard only helps with handoff on a centre device; it is not authentication.

## Demo answer provider

`DemoLocalAnswerProvider` separates student payload creation from staff marking data and objective marking. Its local implementation still runs in public JavaScript. A production deployment must replace it with authenticated server endpoints as described in `docs/SECURE_BACKEND_PLAN.md`.
