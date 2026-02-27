# Meal planner

The meal planner shows a configurable set of meal types (e.g. Breakfast, Lunch, Dinner) over a configurable number of weeks, under the main calendar on the dashboard. Anyone in the household can add a meal on a given day; the UI shows their name and **global display color** (the same color used for their calendar events).

## Configuration (household manager)

- **Weeks to show**: 1–4 (default 2). Set in **Settings → Meal planner** per household, or via `PATCH /api/households/{id}` with `meal_planner_weeks`.
- **Meal types**: Default are Breakfast, Lunch, Dinner. In **Settings → Meal planner** the manager can add meal types (e.g. Snack) and remove them. Order is by `position` (reorder via `PATCH /api/meal-slots/{id}` with `position`).

## Adding a meal

Any household member can claim a meal for a day/slot. The planner shows their name and color. Only the current user can assign themselves (member_id must be the current user’s member for that household). One planned meal per (household, date, meal_slot); adding again replaces the existing one.

## API summary

- `GET /api/meal-slots?household_id=` — list meal types (creates defaults if none).
- `POST /api/meal-slots` — create meal type.
- `PATCH /api/meal-slots/{id}` — update name/position.
- `DELETE /api/meal-slots/{id}` — remove meal type.
- `GET /api/planned-meals?household_id=&start_date=&end_date=` — list planned meals in range (includes member_display_name, member_color).
- `POST /api/planned-meals` — create or replace planned meal (member_id must be current user’s member).
- `DELETE /api/planned-meals/{id}` — remove planned meal.

See [DATA_MODEL.md](DATA_MODEL.md) for MealSlot and PlannedMeal, and [ARCHITECTURE.md](ARCHITECTURE.md) for component overview.
