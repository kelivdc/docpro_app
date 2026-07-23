-- Aggregate existing daily usage rows into monthly (YYYY-MM format)
UPDATE usage SET date = LEFT(date, 7) WHERE LENGTH(date) = 10;

-- Remove duplicates after aggregation: keep the row with highest total_tokens per user+month
DELETE FROM usage WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, LEFT(date, 7) ORDER BY total_tokens DESC) AS rn
    FROM usage
  ) sub WHERE rn > 1
);
