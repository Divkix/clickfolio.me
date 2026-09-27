-- contact.location used to be HTML-escaped before storage (sanitizeText), so React double-escaped
-- it ("Remote &#x2F; On-site"). Decode the stored values. Every edit re-escaped the value, so loop
-- until nothing matches; each pass shortens a matching string, so the loop terminates.
CREATE FUNCTION pg_temp.unescape_html(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT replace(replace(replace(replace(replace(replace(t,
    '&#x2F;', '/'), '&#x27;', ''''), '&quot;', '"'), '&lt;', '<'), '&gt;', '>'), '&amp;', '&')
$$;
--> statement-breakpoint
DO $$
DECLARE
  n int;
  total int;
BEGIN
  LOOP
    total := 0;

    UPDATE "site_data"
    SET "content" = jsonb_set("content", '{contact,location}',
      to_jsonb(pg_temp.unescape_html("content" #>> '{contact,location}')))
    WHERE "content" #>> '{contact,location}' ~ '&(amp|lt|gt|quot|#x27|#x2F);';
    GET DIAGNOSTICS n = ROW_COUNT;
    total := total + n;

    UPDATE "site_data"
    SET "preview_location" = pg_temp.unescape_html("preview_location")
    WHERE "preview_location" ~ '&(amp|lt|gt|quot|#x27|#x2F);';
    GET DIAGNOSTICS n = ROW_COUNT;
    total := total + n;

    UPDATE "resumes"
    SET "parsed_content" = jsonb_set("parsed_content", '{contact,location}',
      to_jsonb(pg_temp.unescape_html("parsed_content" #>> '{contact,location}')))
    WHERE "parsed_content" #>> '{contact,location}' ~ '&(amp|lt|gt|quot|#x27|#x2F);';
    GET DIAGNOSTICS n = ROW_COUNT;
    total := total + n;

    EXIT WHEN total = 0;
  END LOOP;
END $$;
