-- No public SELECT policy: viewers read only the safe projection through the Edge Function.
alter table public.tabletop_rooms
    add column if not exists transmission_paused boolean not null default false;
comment on column public.tabletop_rooms.transmission_paused is
    'The owner freezes the outgoing canvas and published image while preparing a draft.';
