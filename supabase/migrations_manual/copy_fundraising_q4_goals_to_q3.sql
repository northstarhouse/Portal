-- Run once in the Supabase SQL editor.
-- Fundraising has no Q3 2026 goals row. This copies their Q4 2026 goals (primary focus, goals 1-3 and the extra goals) into a new Q3 2026 row.
-- Progress statuses and summaries start empty. If a Q3 row already exists, nothing is changed.
insert into "Op Quarter Goals" (area, quarter, year, primary_focus, goal_1, goal_2, goal_3, extra_goals)
select area, 'Q3', year, primary_focus, goal_1, goal_2, goal_3, extra_goals
from "Op Quarter Goals"
where area = 'Fundraising' and quarter = 'Q4' and year = 2026
  and not exists (
    select 1 from "Op Quarter Goals" where area = 'Fundraising' and quarter = 'Q3' and year = 2026
  );
