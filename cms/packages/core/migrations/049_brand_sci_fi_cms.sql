-- Migration 049: the CMS introduces itself as Sci-Fi CMS
--
-- The admin's wordmark, and the site name in Settings, still carried the upstream
-- names. Both are Sci-Fi CMS now. Only the stock values are replaced, so a name an
-- operator chose is left alone.

UPDATE settings
SET value = '"Sci-Fi CMS"', updated_at = unixepoch() * 1000
WHERE category = 'general'
  AND key = 'siteName'
  AND value IN ('"SonicJS AI"', '"Flare CMS"');
