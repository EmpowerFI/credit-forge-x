-- Her progress in EmpowerFI's own icons.
--
-- The twelve stock emojis of 20261210 give way to five icons drawn for
-- EmpowerFI: coins growing, the money bag, the dashboard, the calendar of
-- kept days and the folder in order. The column keeps a code, not a
-- picture; the diary draws the icon. Whatever she had picked is no longer
-- offered, so everyone starts on the first, and can change it.

alter table public.diary_reminder_settings
  drop constraint diary_reminder_settings_progress_emoji_check;

update public.diary_reminder_settings set progress_emoji = 'growth';

alter table public.diary_reminder_settings
  alter column progress_emoji set default 'growth',
  add constraint diary_reminder_settings_progress_emoji_check
    check (progress_emoji in ('growth', 'money_bag', 'dashboard', 'calendar', 'folder'));
