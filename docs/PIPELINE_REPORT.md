# CI/CD pipeline report

Last checked 1 October 2026, against `main` at `32d7837` (PR #3).

There is one workflow, `.github/workflows/ci.yml` ("CI/CD Pipeline"), with eight jobs. It runs on pushes and pull requests to `main` and `develop`. There are no `paths` filters, no `workflow_run` or `workflow_dispatch`-only triggers, no `concurrency` groups and no `[skip ci]` commits. The workflow is active, and branch protection is off (see the end of this report).

## Status

| Job | Trigger | Before (run 36853445403) | Why | Fix | Verified (run 36888217845, `main`) |
|---|---|---|---|---|---|
| backend-checks | push, PR | ✅ passed | | Actions moved to Node 24 releases | ✅ passed |
| frontend-checks | push, PR | ✅ passed | | `npm install` → `npm ci` | ✅ passed |
| web-landing-checks | push, PR | ✅ passed | | | ✅ passed |
| admin-web-checks | push, PR | ✅ passed | | `npm ci` and npm cache, using a new lockfile | ✅ passed |
| ml-checks | push, PR | ✅ passed | | `setup-python` v7 | ✅ passed |
| dependency-audit | push, PR | ❌ **failed** | New high advisories in nodemailer (see below) | Dependency upgrades, root `overrides`, audit covers every package | ✅ passed |
| docker-build | push to `main` only | ⏭ skipped | `needs: dependency-audit`, which failed | Fixed upstream | ✅ passed, images pushed to GHCR |
| deploy | push to `main` only | ⏭ skipped | `needs: docker-build`, which was skipped | Fixed upstream | ✅ passed, **but deployed nothing**: `EC2_HOST` is not set |

On pull requests, `docker-build` and `deploy` are skipped on purpose (`if: github.event_name == 'push' && github.ref == 'refs/heads/main'`), so a PR never publishes images or deploys. That is the only deliberate skip.

## Why `dependency-audit` failed

Root cause: **dependency drift**. On 30 September nodemailer published fixes for five advisories (one rated high), so `npm audit --omit=dev --audit-level=high` began failing on code that had not changed.

The first failing step was "Audit production dependencies", on `backend`. It ran under `bash -e` and stopped at the first package, so it also hid the following:

| Package | Advisory | Severity | Where |
|---|---|---|---|
| nodemailer ≤10.0.8 | GHSA-6vj9-mwq6-2f5v and four others | high | backend, web-landing |
| @grpc/grpc-js <1.13.6 (via firebase) | GHSA-m9gg-hp2v-232j, GHSA-f596-whhp-79r4 | high | frontend, admin-web |
| maplibre-gl ≤6.4.0 | GHSA-jrc7-96c5-q579 (XSS sanitizer bypass) | **critical** | admin-web (CI never audited admin-web) |
| uuid <11.1.1 (via exceljs, gaxios, xcode) | GHSA-w5hq-g745-h8pq | moderate | backend, frontend |

Two structural problems sat behind this:

1. **npm ignores `overrides` in workspace members.** The repo root is an npm workspace, so the `uuid` overrides in `backend/` and `frontend/` never applied. Overrides now live in the root `package.json`.
2. **Two sets of lockfiles.** CI installs from the root workspace lockfile, but the backend Docker image installs from `backend/package-lock.json` and Vercel from each package's own lockfile. These had drifted apart: `backend/package-lock.json` was missing `pdfkit`, `exceljs` and `@anthropic-ai/sdk`. So the next `docker-build` would have failed at `npm ci` even with a clean audit.

## What changed (PR #3)

- nodemailer 9 → 10.0.13 (backend, web-landing). Its only breaking change is Node ≥ 20. The Docker image runs Node 20 and CI runs 22; `engines` is raised to match.
- maplibre-gl 5 → 6.11.2 (admin-web). v6 has no default export, so `MapView.tsx` uses `import * as maplibregl`.
- `@grpc/grpc-js` ^1.13.6 and `uuid` ^11.1.1 in the root `overrides`. Even the latest firebase pins grpc-js ~1.9, so an override is the only fix, and 1.x keeps its API. No package deep-imports `uuid/…`, so uuid 11 is safe.
- Standalone lockfiles regenerated in isolation; admin-web got a lockfile.
- `dependency-audit` now audits backend, frontend, web-landing **and admin-web**, and reports every failing package before it exits.
- New step `scripts/check-lockfiles.sh` fails when a package's own lockfile no longer matches its `package.json`, so what CI audits is what ships.
- Actions moved to their Node 24 majors (checkout v7, setup-node v7, setup-python v7, docker/* v4/v7, ssh-action v1.2.5). This removed the "Node.js 20 is deprecated" annotation from every job. None of their breaking changes affect inputs this workflow uses.
- `.github/dependabot.yml` added for GitHub Actions, pip and Docker. npm is left out because Dependabot updates only one of the two lockfiles; npm advisories are caught by `dependency-audit`. Dependabot alerts and security updates are switched on for the repository.

## Verification

- Locally: `npm audit --omit=dev` reported 0 vulnerabilities (of any severity) in all four packages, both through the workspace and standalone. `pip-audit` found no known vulnerabilities in the ML service. Every CI command passed, including all backend tests. The backend and ML Docker images built, and nodemailer 10 loads in the backend image.
- PR #3, run 36887326115: all six checks passed.
- `main`, run 36888217845: all eight jobs passed.
- The admin web was built and served with its new security headers. Its sign-in page loaded in headless Chrome with no CSP violations.

No step or test was disabled or weakened. The 46 backend test failures seen during the local run came from a full `/tmp` (MongoDB's in-memory server refuses to start below 500 MB free). After clearing stale test databases, all of them passed.

## Still open

| Item | Owner | Notes |
|---|---|---|
| `deploy` does nothing until a server exists | Owner | Add `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY` as repository secrets, or deploy the backend elsewhere (see `GO_LIVE_GUIDE.md`) |
| `ubuntu-latest` becomes Ubuntu 26 from 19 October 2026 | Watch | Informational annotation on every job. Pin `ubuntu-24.04` if anything breaks after the switch |
| Branch protection on `main` is off | Owner | Settings → Branches → add a rule for `main`: require a pull request and require the six check jobs to pass |
| One lockfile instead of two | Engineering | Building the backend image from the repo root with `npm ci -w backend` would remove the second lockfile set and `check-lockfiles.sh` |
