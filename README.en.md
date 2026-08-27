# Attendance & Absence Management System

> A self-service attendance system for a small in-person / online learning group, built on Google Apps Script + Google Sheets. **Currently in production** with ~10 students and 2 teachers.

[中文版 →](./README.md)

---

## The Problem

A small teaching group ran two kinds of sessions, in-person and online, and tracked attendance by hand. For a class of ~10 people that meant a teacher had to:

- Manually note who showed up, who asked for leave, and who simply never appeared.
- Remember, across weeks, *who was trending toward dropping out* so they could reach out. The group's retention policy was surprisingly specific:
  - A single unexcused absence should lock the account and force a conversation.
  - Two **consecutive** excused absences from **in-person** sessions was also a warning sign, but leave from **online** sessions didn't count the same way.

Those rules are easy to state and hard to apply consistently by hand. A teacher juggling a live class will miss an edge case, and the "should we follow up with this person" decision quietly slips.

## Who Uses It

| Role | What they do |
|------|--------------|
| **Student** | Log in, see a personal dashboard, request leave *before* a session starts, sign in *during* a session, view their own attendance history and study group. |
| **Teacher / Admin** | Create, edit, and delete sessions; start and end a session; review and manually correct attendance; assign students to groups; manage members and unlock accounts. |

## The Solution

A single-page web app backed by Google Sheets. Students self-serve, and the rules that used to live in a teacher's head now run automatically:

- **Sign-in is only possible while a session is "ongoing."** No signing in early, no signing in after it ends.
- **Leave can only be requested before a session starts.** Once class begins, the window closes.
- **When a teacher ends a session, anyone who neither signed in nor took leave is automatically marked absent** and their account is locked, turning a manual review into a side effect of closing the class.
- **Account locking encodes the retention policy directly:** one unexcused absence locks; two consecutive in-person leaves lock; online leave is exempt.
- **Admins can override anything.** Real classes are messy, so a teacher can retroactively change any status, and the lock/unlock logic re-evaluates when they do.

## Business Rules

These rules are the actual product. The UI is just how you touch them.

| Rule | Behavior |
|------|----------|
| Sign-in | Allowed only when a session's status is *ongoing*. |
| Leave request | Allowed only when a session is *upcoming* (not yet started). |
| Auto-absence | On session end, students with no record are marked *absent*. |
| Lock on absence | One unexcused absence (in-person or online) locks the account. |
| Lock on repeated leave | Two **consecutive** in-person leaves lock the account. |
| Online exemption | Leave from online sessions is not counted toward consecutive-leave locking. |
| Admin override | An admin can change any attendance status at any time; locks re-evaluate automatically. |

## Architecture

```
Browser (single-page app)
   │   Bootstrap 5 UI, google.script.run RPC
   ▼
Google Apps Script  (Code.gs)  ── serves index.html, exposes server functions
   │
   ▼
Google Sheets  (three tabs as the datastore)
   ├── members     accounts, roles, group, lock state, consecutive-leave count
   ├── courses     session id, date, time, type (in-person/online), location, status
   └── attendance  per-session records: status, timestamp, note
```

- **Frontend:** one HTML file, Bootstrap 5, no build step. Session is cached in `localStorage` for one hour.
- **Backend:** Google Apps Script functions called directly from the browser via `google.script.run`.
- **Datastore:** Google Sheets — three tabs (`members` / `courses` / `attendance`).
- **Deployment:** published as an Apps Script Web App.

## Key Design Decisions & Trade-offs

- **Google Sheets as the database.** Chosen deliberately, not by default. The client is non-technical; Sheets means they can read, audit, and hand-fix data without me, and there's zero hosting cost or ops burden. The trade-off is no real transactions and weak concurrency guarantees — acceptable for a group of ~12 where writes rarely collide.
- **Rules enforced server-side, not in the UI.** The sign-in window, leave window, and locking logic all live in `Code.gs`, so the browser can't be tricked into an invalid state by a stale page.
- **Locking is derived, not just toggled.** When an admin corrects a status, the system recomputes whether the account should be locked rather than trusting a stale flag — because the whole point was to remove manual bookkeeping, and a half-manual lock state would reintroduce it.
- **One-hour client session.** A pragmatic compromise between "log in every time" and holding credentials indefinitely, appropriate for a low-sensitivity internal tool.
- **Sensitive config kept out of version control.** The real backend file (which holds the production Google Sheets ID) is gitignored; a de-identified example file is committed instead as a reference. Production resource identifiers never enter the public repo.

## Impact

Measured honestly, without invented percentages:

- **Before:** the teacher manually recorded leave and absence each session, and had to personally track who was trending toward dropping out across in-person vs. online sessions — rules that are easy to misremember mid-class.
- **After:** students self-serve sign-in and leave; the system applies the absence and locking rules automatically; the teacher only steps in for genuine exceptions. The "who do we need to follow up with" signal now falls out of the data instead of living in someone's memory.
- **In production** with ~10 students and 2 teachers across in-person and online sessions.

## Screenshots

<!-- TODO: add real screenshots. Suggested set:
     1. Student dashboard (attendance summary + upcoming sessions)
     2. Course management (admin)
     3. Attendance review with manual override (admin)
     4. Group management overview -->

_Screenshots coming soon._

## Tech Stack

- Google Apps Script (backend + hosting)
- Google Sheets (datastore)
- HTML + Bootstrap 5 (frontend, no build step)

## Note on Access

This system is deployed as a private Web App for the specific group that uses it, so the live URL is not public. The source is shared here as a reference implementation.

## License

For learning and reference purposes.
