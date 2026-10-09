# Handoff notes

Three lines per person per day: done / half-done / next.

## Thu Oct 8
- **Sarayu (solo today)** done: repo, SAM stack (API, DynamoDB, S3, container Lambda), engine (expected, detect, verdict), demo homes, household web app on Amplify (https://main.d1x4u3l99wlpcs.amplifyapp.com) with Hindi voice.
- also done: accuracy harness (M1 + M2). Held-out Plant 1: trips 60/60, 20% drops 40/40, dust 30/38, false alarms 0.56% of clean days. Live at GET /accuracy.
- half-done: nothing.
- next: Step Functions issue loop, installer page, clean-or-skip, evidence chart.

## Thu Oct 8 evening (Day 2 work started early)
- **Sarayu** done: Step Functions issue loop (email, reminder at half time, escalation draft at the deadline, fix check, reopen or fixed), Cedar rules (installer never sees bill or contact; nothing sent without household approval), evidence chart, clean-or-skip, fix verification, recovered counter, installer page `/r/:token`, status timeline, demo controls (replay and reset).
- Demo clock: `DEMO_TIME_SCALE` in `.env.local` (1 = real 7 days, 1440 = 7 minutes). Deploy API with `scripts/deploy_api.sh`, site with `scripts/deploy_web.sh`.
- next: accuracy page in the app, mobile polish, README, video. Bill check and warranty reminder only if time allows.
- Also done (Thu evening): Accuracy page in the app (/accuracy), mobile fix for the chart, README, architecture diagram (docs/architecture.svg), demo script (docs/demo-script.md).
- next: blog post, polish, final end-to-end run on the deployed site, flip DEMO_TIME_SCALE / DemoMode before submitting.

## Status at end of Thu Oct 8
- Every must-build feature is done and live: expected vs actual (units/₹/CO₂), Indian accuracy test, clean or skip (with a demo weather switch), send to installer with reminder, escalation and fix verification, Hindi voice, Cedar rules, accuracy page, README, architecture diagram, demo script, blog draft (`docs/blog-draft.md`).
- Not built (all "if time allows" in the plan): bill check, warranty reminder, US rooftop (PVDAQ) check, nightly and weekly schedules (only the daily fix check runs), DeepSolarEye calibration. No household login (documented in the README's limits).
- API docs are current: `docs/api.md`.
- Still to do: commits, blog publish, sources for the soiling figure, video, repo public, final live check, submit.
