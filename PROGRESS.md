# Frame — Project Progress

A living checklist of work on the Frame form-builder project. Updated as tasks complete.

_Last updated: 2026-07-09_

## ✅ Completed
- [x] Product teardown & build blueprint — 18 sections (`tally-teardown.html`, `TALLY-TEARDOWN.md`)
- [x] AWS infrastructure cost analysis section added to the report
- [x] Capacity planning & scaling-design section added to the report
- [x] Clickable prototype — 15 screens (`frame-prototype.html`)
- [x] Monorepo scaffold: Next.js `web` + NestJS `api` + `form-schema` (walking skeleton verified end-to-end)
- [x] Marketing site — landing + `/pricing`; dashboard moved to `/app`
- [x] Docs & mockup embedded in the app — `/docs`, `/mockup`
- [x] Mockup typography upgrade — Hanken Grotesk across all 15 screens
- [x] Deep-polished the form builder — cover-gradient depth + firmer title weight
- [x] Polished data screens — removed the perpetual card-thumbnail **shimmer** on the dashboard (was reading as "stuck loading"); responses & analytics verified clean and lifted by the type upgrade

## 🚧 In progress
- _(nothing in flight)_

## ⏭️ Next / backlog
- [ ] Builder UI wired to persist blocks into `FormVersion.schema` (real)
- [ ] Public form runtime `/r/[slug]` + submit endpoint
- [ ] Auth (Auth.js) + org scoping on every query
- [ ] Align marketing site typography to Hanken (web ↔ mockup consistency)
- [ ] Deploy: Vercel (web) + API host + Neon Postgres
