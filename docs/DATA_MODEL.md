# Data Model

## Overview

The data layout is centered on **Household** and **Member**. Each household has one or more members; each member has exactly one Google account (used for OAuth). Each member can add zero or more calendars. When a calendar is added by a member, it is visible to every other member in the same household (no separate sharing step in the app).

## Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   User      │       │   Member    │       │  Calendar   │
│ (Google     │──1:*──│ (Household  │──1:*──│ (Google     │
│  identity)  │       │  membership)│       │  calendar)  │
└─────────────┘       └──────┬──────┘       └─────────────┘
                             │
                             │ *:1
                             │
                      ┌──────▼──────┐
                      │  Household  │
                      └─────────────┘
```

## Entities

### User

One row per **Google account** (global). Holds OAuth identity and tokens so we only store tokens once per person, even if they belong to multiple households.

| Field           | Type      | Description |
|-----------------|-----------|-------------|
| id              | PK        | Internal ID |
| google_sub      | string    | Google OAuth subject ID (unique) |
| email           | string    | From Google |
| display_name   | string?   | From Google |
| avatar_url     | string?   | From Google |
| refresh_token  | text      | Google refresh token (store encrypted) |
| access_token   | text?    | Cached access token |
| token_expiry   | datetime? | When access_token expires |
| created_at     | datetime  | |
| updated_at     | datetime  | |

**Constraints:** `google_sub` unique.

---

### Household

The top-level container. One household = one “home” with a shared view of all members’ calendars.

| Field     | Type     | Description |
|-----------|----------|-------------|
| id        | PK       | Internal ID |
| name      | string   | e.g. "Smith Family" |
| created_at| datetime | |
| updated_at| datetime | |

Optional later: `invite_code` for inviting new members.

---

### Member

Links a **User** to a **Household**. A user can be in multiple households (e.g. family + roommates); each membership is one row.

| Field        | Type     | Description |
|--------------|----------|-------------|
| id           | PK       | Internal ID |
| user_id      | FK User  | |
| household_id | FK Household | |
| role         | string?  | e.g. "owner", "member" (for future use) |
| joined_at    | datetime | |
| created_at   | datetime | |
| updated_at   | datetime | |

**Constraints:** `(user_id, household_id)` unique (one membership per user per household).

---

### Calendar

A Google calendar that a **member** has added to the app. It is shown to all members of that member’s household.

| Field              | Type       | Description |
|--------------------|------------|-------------|
| id                 | PK         | Internal ID |
| member_id          | FK Member  | Member who added it |
| google_calendar_id | string     | Google Calendar ID ("primary" or long id) |
| name               | string     | Display name (from Google or override) |
| color              | string?    | Hex color for UI |
| is_visible         | boolean    | Whether to include in aggregated view (default true) |
| created_at         | datetime   | |
| updated_at         | datetime   | |

**Constraints:** `(member_id, google_calendar_id)` unique (same calendar can’t be added twice by the same member).

---

## Sharing semantics

- **“When a calendar is added, it is shared with every other member”** is implemented by **visibility by household**, not by a separate share table:
  - Calendars are stored per **Member** (who added them).
  - For a given **Household**, “all calendars” = all calendars whose `member` belongs to that household.
  - So when member A adds a calendar, it is immediately visible to members B, C, … in the same household.
- No extra “CalendarShare” or “HouseholdCalendar” table is required for this behavior.

Optional future: use the Google Calendar API to **share the calendar** with other members’ Google accounts (e.g. “see this calendar in their own Google Calendar”). That would be an integration feature; the app’s aggregated view only needs the model above.

---

## Query patterns

1. **Current user’s households**  
   `Member` where `user_id = current_user_id`.

2. **All members of a household**  
   `Member` where `household_id = current_household_id`.

3. **All calendars for a household (unified view)**  
   `Calendar` joined to `Member` where `Member.household_id = current_household_id` (and optionally `Calendar.is_visible = true`).

4. **Calendars belonging to one member**  
   `Calendar` where `member_id = member_id`.

5. **Resolve current user from session**  
   Session stores `user_id` (or equivalent); load `User` and then `Member`(s) for that user.

---

## Indexes (recommended)

- `User.google_sub` (unique, for login lookup).
- `Member(user_id, household_id)` (unique).
- `Member(household_id)` (for “all members” and “all calendars for household”).
- `Calendar(member_id)` (for “member’s calendars”).
- `Calendar(member_id, google_calendar_id)` (unique).

These align with the query patterns above; exact index definitions can be added in migrations (e.g. Alembic) when you introduce them.
