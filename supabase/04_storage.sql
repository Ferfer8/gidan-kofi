-- =====================================================================
-- 04_storage.sql
-- Storage for menu item photos.
--
-- Run this FOURTH. Safe to run again.
--
--   * A PUBLIC bucket called menu-images: anyone can view an image by its link
--     (the POS needs that).
--   * Only signed-in managers can upload, replace or delete files in it.
--   * Only JPG, PNG and WebP files, up to 2 MB each.
--   * The demo login (the manager flagged staff.is_demo_login), if there is one, can not delete files, so a reset can restore them.
--
-- (Realtime for menu_items and item_sizes, so new images show on the POS at once, is
-- switched on in 01_schema.sql.)
-- =====================================================================

-- ---------------------------------------------------------------------
-- The bucket
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images',
  'menu-images',
  true,
  2097152,                                              -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;


-- ---------------------------------------------------------------------
-- Who may change files
-- Viewing a public bucket's files by link needs no policy. The SELECT policy is for managers: deleting and replacing files needs to be able to see them.
-- ---------------------------------------------------------------------

drop policy if exists "Managers can view menu images" on storage.objects;
drop policy if exists "Managers can upload menu images" on storage.objects;
drop policy if exists "Managers can replace menu images" on storage.objects;
drop policy if exists "Managers can delete menu images" on storage.objects;

create policy "Managers can view menu images" on storage.objects
  for select
  to authenticated
  using ((bucket_id = 'menu-images') AND public.is_manager());

create policy "Managers can upload menu images" on storage.objects
  for insert
  to authenticated
  with check ((bucket_id = 'menu-images') AND public.is_manager());

create policy "Managers can replace menu images" on storage.objects
  for update
  to authenticated
  using ((bucket_id = 'menu-images') AND public.is_manager())
  with check ((bucket_id = 'menu-images') AND public.is_manager());

create policy "Managers can delete menu images" on storage.objects
  for delete
  to authenticated
  using ((bucket_id = 'menu-images') AND public.is_manager() AND (NOT public.is_demo_user()));

