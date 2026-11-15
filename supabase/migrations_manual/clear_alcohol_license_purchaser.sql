-- The two alcohol license expenses added by the Selling alcohol prompt were wrongly marked "Purchased by" the person who
-- ran the prompt. Clear that (the amounts and everything else stay).
update "Op Budget" set purchased_by = null, volunteer_name = null where id in (76, 77);
