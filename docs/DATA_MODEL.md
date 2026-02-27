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
                      ┌──────▼──────┐       ┌─────────────┐
                      │  Household  │──1:*──│  TodoItem   │
                      │             │       └─────────────┘
                      │             │       ┌─────────────┐
                      │             │──1:*──│  MealSlot   │
                      │             │       └─────────────┘
                      │             │       ┌─────────────┐
                      │             │──1:*──│ PlannedMeal │
                      │             │       └─────────────┘
                      │             │       ┌─────────────┐       ┌──────────────────┐
                      │             │──1:*──│ GroceryList  │──1:*──│ GroceryListItem  │
                      └─────────────┘       └─────────────┘       └──────────────────┘
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

The top-level container. One household = one "home" with a shared view of all members' calendars and a shared to-do list.

| Field               | Type     | Description |
|---------------------|----------|-------------|
| id                  | PK       | Internal ID |
| name                | string   | e.g. "Smith Family" |
| meal_planner_weeks  | int      | How many weeks to show in meal planner (1–4, default 2) |
| created_at         | datetime | |
| updated_at         | datetime | |

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
| event_color  | string?  | Global display color for this person (calendar events, meal planner) |
| joined_at    | datetime | |
| created_at   | datetime | |
| updated_at   | datetime | |

**Constraints:** `(user_id, household_id)` unique (one membership per user per household).

---

### Calendar

A Google calendar that a **member** has added to the app. It is shown to all members of that member's household.

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

**Constraints:** `(member_id, google_calendar_id)` unique (same calendar can't be added twice by the same member).

---

### Invitation

Tracks an invite (by email) to join a household. When the invite is accepted, a **Member** is created and the invitation is marked accepted.

| Field                | Type        | Description |
|----------------------|-------------|-------------|
| id                   | PK          | Internal ID |
| household_id         | FK Household| |
| email                | string      | Invitee email |
| invited_by_member_id | FK Member   | Member who sent the invite |
| token                | string      | Unique token for the accept link |
| status               | string      | `pending` \| `accepted` \| `expired` |
| sent_at              | datetime    | When the invite was first sent |
| last_sent_at         | datetime    | When it was last sent (updated on resend) |
| accepted_at          | datetime?   | When it was accepted (null until then) |
| created_at           | datetime    | |
| updated_at           | datetime    | |

**Accept flow:** Client calls `POST /api/invitations/accept` with `{ "token": "...", "user_id": <id> }`. Server creates `Member(user_id, household_id)` if not already a member, and sets `Invitation.status = "accepted"`, `accepted_at = now`.

---

### TodoItem

A shared to-do list item for a **Household**. All members of the household see the same list. Items can be regular tasks (with check-off) or **section headers** (bold, styled) to organize the list. Items that have been checked off for 7 days are automatically removed when the list is loaded.

| Field              | Type       | Description |
|--------------------|------------|-------------|
| id                 | PK         | Internal ID |
| household_id       | FK Household | |
| content            | string     | Display text (or section title) |
| is_section_header  | boolean    | If true, rendered as a section header (bold, fancy background) |
| is_checked         | boolean    | For regular items: whether checked off |
| checked_at         | datetime?  | When the item was checked; used to auto-remove after 7 days |
| position           | int        | Display order (lower first) |
| created_at         | datetime   | |
| updated_at         | datetime   | |

**Constraints:** None beyond `household_id` FK.

**Cleanup:** When listing todos, the API deletes any items where `is_checked = true` and `checked_at < now - 7 days`, then returns the remaining items ordered by `position`, then `id`.

---

### MealSlot

A meal type for a household's meal planner (e.g. Breakfast, Lunch, Dinner). The household manager defines which meals appear and their order. Default for new households: Breakfast, Lunch, Dinner.

| Field        | Type       | Description |
|--------------|------------|-------------|
| id           | PK         | Internal ID |
| household_id | FK Household | |
| name         | string     | e.g. "Breakfast" |
| position     | int        | Display order (lower first) |
| created_at   | datetime   | |

---

### PlannedMeal

One planned meal on a given day and meal slot. Shows who added it (member); the UI uses the member's **global display color** (event_color) and their name.

| Field        | Type       | Description |
|--------------|------------|-------------|
| id           | PK         | Internal ID |
| household_id | FK Household | |
| meal_date    | date       | The day (date only) |
| meal_slot_id | FK MealSlot | Which meal (e.g. Lunch) |
| member_id    | FK Member  | Who added it / who's responsible |
| description  | string?    | Optional note |
| created_at   | datetime   | |

**Constraints:** `(household_id, meal_date, meal_slot_id)` unique (one planned meal per slot per day).

---

### GroceryList

A named grocery list for a household (e.g. "Groceries" by default, or "Costco"). One household has one or more lists; you cannot delete the last list.

| Field        | Type       | Description |
|--------------|------------|-------------|
| id           | PK         | Internal ID |
| household_id | FK Household | |
| name         | string     | e.g. "Groceries", "Costco" |
| created_at   | datetime   | |
| updated_at   | datetime   | |

---

### GroceryListItem

One item on a grocery list. Same pattern as to-do: section headers and regular items, ordered by `position`. `member_id` indicates who added the item (UI shows a dot in that member's global color).

| Field             | Type       | Description |
|-------------------|------------|-------------|
| id                | PK         | Internal ID |
| grocery_list_id   | FK GroceryList | |
| content           | string     | Item or section title |
| is_section_header | boolean    | Section header vs regular item |
| position          | int        | Display order |
| member_id         | FK Member? | Who added it (for color dot) |
| created_at        | datetime   | |
| updated_at        | datetime   | |

---

## Sharing semantics

- **"When a calendar is added, it is shared with every other member"** is implemented by **visibility by household**, not by a separate share table:
  - Calendars are stored per **Member** (who added them).
  - For a given **Household**, "all calendars" = all calendars whose `member` belongs to that household.
  - So when member A adds a calendar, it is immediately visible to members B, C, … in the same household.
- No extra "CalendarShare" or "HouseholdCalendar" table is required for this behavior.

Optional future: use the Google Calendar API to **share the calendar** with other members' Google accounts (e.g. "see this calendar in their own Google Calendar"). That would be an integration feature; the app's aggregated view only needs the model above.

---

## Query patterns

1. **Current user's households**  
   `Member` where `user_id = current_user_id`.

2. **All members of a household**  
   `Member` where `household_id = current_household_id`.

3. **All calendars for a household (unified view)**  
   `Calendar` joined to `Member` where `Member.household_id = current_household_id` (and optionally `Calendar.is_visible = true`).

4. **Calendars belonging to one member**  
   `Calendar` where `member_id = member_id`.

5. **Resolve current user from session**  
   Session stores `user_id` (or equivalent); load `User` and then `Member`(s) for that user.

6. **To-do list for a household**  
   `TodoItem` where `household_id = X`, ordered by `position`, `id`. Only members of that household may list/add/update/delete.

7. **Meal planner**  
   `MealSlot` where `household_id = X`, ordered by `position`. `PlannedMeal` where `household_id = X` and `meal_date` in range. Only members may list/add/update/delete. Default slots (Breakfast, Lunch, Dinner) are created when listing slots and none exist.

8. **Grocery lists**  
   `GroceryList` where `household_id = X`. If none exist, a default list "Groceries" is created when listing. `GroceryListItem` where `grocery_list_id = Y`, ordered by `position`. Only members may list/add/update/delete. Cannot delete the last list.

---

## Indexes (recommended)

- `User.google_sub` (unique, for login lookup).
- `Member(user_id, household_id)` (unique).
- `Member(household_id)` (for "all members" and "all calendars for household").
- `Calendar(member_id)` (for "member's calendars").
- `Calendar(member_id, google_calendar_id)` (unique).
- `TodoItem(household_id)` (for listing a household's to-do items).
- `MealSlot(household_id)` (for listing a household's meal types).
- `PlannedMeal(household_id)`, `PlannedMeal(meal_date)` (for listing planned meals in range).
- `GroceryList(household_id)` (for listing a household's grocery lists).
- `GroceryListItem(grocery_list_id)` (for listing a list's items).

These align with the query patterns above; exact index definitions can be added in migrations (e.g. Alembic) when you introduce them.
