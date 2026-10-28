# Five-member demo pilot

Completed September 9, 2026 at the user’s request using synthetic members only.

Each member saved one goal and one personal win through the built portal’s authenticated server actions. A temporary demo administrator saved and published one clearly labeled sample recap per member. The temporary administrator role was removed. These are sample notes, not recaps authored by Kelsey.

## Checks passed

- Five independent password sign-ins and goal/win submissions.
- Each member could query only their own saved goal.
- Draft recaps were hidden from the four ordinary members tested while the fifth account temporarily exercised the coach workflow.
- All five recap drafts saved and published with the editor’s current goal/activity evidence and confirmation.
- After removing temporary admin access, all five accounts could query only their own published recap.
- The live production Progress page returned successfully and displayed each account’s goal and published sample recap.
- All five contacts are marked as tests and opted out of email. No emails were sent.

## Scope and retained data

Writes exercised the existing production build running locally against the live database; final member-page reads exercised https://portal.holden.health. These are new-member stories with zero recorded workouts/classes/habit days and one synthetic personal win each. This pilot did not exercise nonzero activity aggregation or substitute for Kelsey’s own writing and usability review. No application code or deployment changes were needed.

Five demo profiles, goals, wins, and published recaps remain available for review. Temporary test sessions were revoked; temporary credentials were removed from disk.

[Open demo stories](https://portal.holden.health/admin/stories?q=DEMO%20Story%20Pilot) — staff sign-in required.

- [Avery (DEMO Story Pilot)](https://portal.holden.health/admin/stories/6c4a7fcf-4434-41e8-ac87-15fb7550d17f)
- [Morgan (DEMO Story Pilot)](https://portal.holden.health/admin/stories/a4f88827-b656-444d-9143-bcf640b4e4eb)
- [Riley (DEMO Story Pilot)](https://portal.holden.health/admin/stories/382437be-ee28-4a8e-8af5-bd187e15b9b1)
- [Casey (DEMO Story Pilot)](https://portal.holden.health/admin/stories/6978c460-b38b-415f-97c8-79b63ca16850)
- [Jordan (DEMO Story Pilot)](https://portal.holden.health/admin/stories/409dceb3-8312-4888-bc28-da6df42ea97b)
