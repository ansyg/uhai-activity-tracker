# tracker-web

Next.js app that is **both** the web UI and the backend (API routes + Prisma
+ Postgres) for UHAI Activity Tracker (UAT, see `src/lib/branding.ts`).
`tracker-mobile` talks to this app's API over HTTPS — there is no separate
backend service, by design (see `../ARCHITECTURE.md`).

## Layout

```
prisma/
  schema.prisma        # full data model (+ RefreshToken, added beyond the original design
                        # to back the rotating-refresh-token session described in §5/§11)
  seed/
    index.ts            # entry point: npm run seed -> rbac.ts then seed-from-excel.ts
    rbac.ts              # seeds Menus/Permissions/Roles (the menu-based RBAC in ARCHITECTURE.md §3)
    seed-from-excel.ts   # loads the real first tracker from the root .xlsx
src/
  app/
    (auth)/             # sign-in, sign-up
    accept-invite/      # token acceptance page (outside the auth/dashboard shells)
    (dashboard)/
      trackers/                 # tracker list + "new tracker" form
      trackers/[id]/             # tracker detail: summary dashboard, per-phase progress, activities table
      trackers/[id]/approvals/   # pending join requests (owner/admin only)
      trackers/[id]/members/     # members list + invite-by-email
      admin/systems/             # System Directory screen (Platform Admin only)
      admin/roles/               # Roles & Permissions screen (Platform Admin only)
    api/
      auth/                      # register, login, refresh, logout, Google OAuth sign-in
      trackers/[id]/memberships*, /invites, /phases, /activities, /dashboard
      activities/[id]            # PATCH (writes ActivityHistory), comments
      roles/ | menus/            # permission-matrix CRUD
      systems/                   # System Directory CRUD
      notifications/
  lib/
    auth/                 # password hashing, JWT issuance/verification, session cookies, Google OAuth
    rbac/                  # resolves a caller's Menu+PermissionAction grants, server-side checks
    trackers/              # tracker access control, dashboard aggregation
    notifications/         # in-app Notification rows + branded transactional email (Resend)
  components/              # TopNav, AvatarStack, PhaseLane, NotificationBell, etc. — the shared design system
```

## What's built vs. what's left

Delivery-order items 1–3 from `../ARCHITECTURE.md` §12 are functional end to
end (manually verified): email+password and Google sign-in, the full
menu-based RBAC, System Directory CRUD, Tracker/Phase/Activity CRUD with
`ActivityHistory` on every edit, the tracker summary dashboard, the
subscribe→approve flow, invite-by-email→accept, in-app notifications (the
bell in the top nav), and the two load-bearing transactional emails
(invite, join-decided) via `src/lib/notifications/email.ts` — these log to
the console instead of sending when `EMAIL_PROVIDER_API_KEY` isn't set, so
local dev works without a Resend account.

Not yet built: push notifications, Google Calendar sync, the mobile app's
UI (only its Expo scaffold + branding exist), and the timeline/workload/
trend dashboard views (§12 items 5–7) — the tracker summary dashboard and
per-phase progress are built; by-system/by-module, workload-by-assignee,
and the burndown trend are not.

## Getting started

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL, JWT secrets, Google OAuth, Redis, etc.
npm run prisma:migrate
npm run seed                 # imports "Afya Maoni x GOTHOMIS Integration"
                              # from ../Afya Maoni GoTHOMIS Integration Tracker.xlsx
npm run dev
```

The seeded tracker owner (`SEED_OWNER_EMAIL`) has no password by default —
it's meant to sign in with Google. To sign in with a password locally
instead (e.g. without Google OAuth credentials configured), set one
directly: `UPDATE "User" SET "passwordHash" = ... WHERE email = '...'`, or
sign up a fresh account and use that to explore everything except the
seeded tracker (which is PRIVATE to its owner).

See `../ARCHITECTURE.md` for the full system design: data model, auth &
roles, the tracker join/approval flow, Google Calendar sync, and the
notification system.
# uhai-activity-tracker
