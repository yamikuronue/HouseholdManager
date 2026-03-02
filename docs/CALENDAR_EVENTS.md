# Calendar events: add, edit, remove

The calendar widget uses Google Calendar for events. Adding is supported in-app and via a link to Google; editing and removal are done in Google’s UI.

## Add event

- **In-app**: Use “+ Add event” or click a date. A form asks for name, calendar, description, location, and start/end. “Create event” creates the event via the Google Calendar API (you must have signed in with the `calendar.events` scope).
- **Advanced**: “Advanced: open in Google Calendar” opens Google Calendar’s create screen with the form fields pre-filled so you can finish or change details there.

Only calendars you own (calendars you added under your account) appear in the calendar dropdown. Events are created on the selected Google calendar.

## Edit and remove

- Click an event on the calendar widget. A popover shows the event details and a link **“Open in Google Calendar (edit or delete)”**.
- That link opens the event in Google Calendar in a new tab, where you can edit or delete it.

The backend does not edit or delete events; it only exposes the event’s `htmlLink` from the Google Calendar API so the app can send users to Google for those actions.

## API

- **OAuth**: The app requests `calendar.readonly` and `calendar.events` so it can read events and create them. Existing users may need to sign out and sign in again to grant the new scope.
- **Create**: `POST /api/events` with `calendar_id` (internal calendar id), `title`, `start`, `end`, and optional `description`, `location`. Only the calendar owner can create events on that calendar.
- **Writable calendars**: `GET /api/events/writable-calendars` returns `{ id, name }` for calendars the current user owns (can add events to).
