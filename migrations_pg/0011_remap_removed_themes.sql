-- Seven themes were removed from THEME_IDS. Move their users to the replacement theme listed in
-- REMOVED_THEME_REPLACEMENTS (lib/templates/theme-ids.ts), which keeps reads working until this
-- runs. site_data.theme_id is the only column that stores a theme id. Idempotent: remapped rows no
-- longer match the WHERE clause.
UPDATE "site_data"
SET "theme_id" = CASE "theme_id"
    WHEN 'consulting_brief' THEN 'classic_ats'
    WHEN 'dashboard' THEN 'workspace'
    WHEN 'infographic' THEN 'bento'
    WHEN 'networked' THEN 'bold_corporate'
    WHEN 'noir' THEN 'midnight'
    WHEN 'sidebar_photo' THEN 'bold_corporate'
    WHEN 'timeline' THEN 'minimalist_editorial'
  END
WHERE "theme_id" IN (
  'consulting_brief', 'dashboard', 'infographic', 'networked', 'noir', 'sidebar_photo', 'timeline'
);
