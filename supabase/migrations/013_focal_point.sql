-- ─────────────────────────────────────────────────────────────────────────────
-- Per-photo focal point.
--
-- Every <img> in the journal layouts is rendered with object-fit: cover,
-- which centers the image inside its container and crops the rest. For
-- portraits especially, "center" frequently slices off heads. These two
-- columns store the user-picked point of interest as percentages (0–100).
-- NULL on either column means the photo has not been customised — render
-- with the default 50/50 (center) and don't show the customised-photo
-- indicator dot in the management grid.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.journal_photos
  add column if not exists focal_x smallint
    check (focal_x is null or (focal_x between 0 and 100)),
  add column if not exists focal_y smallint
    check (focal_y is null or (focal_y between 0 and 100));
