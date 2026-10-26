# 26 October 2026: dates as "25 Oct"

No field shows the browser's dd/mm/yyyy any more. `ui/date-field.tsx` shows a day as "25 Oct" (the
year only when it is another year's), takes typed days ("tomorrow", "fri", "25 Oct", "25/10",
"2026-10-25") and opens a small calendar from Monday, worked by the arrow keys too. The value is the
same yyyy-mm-dd as before. In Tasks: the new task's due, a task's Due, and Remind me (a day, and a
time beside it).
