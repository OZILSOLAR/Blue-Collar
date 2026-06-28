-- Issue #747: Full-Text Worker Search with Ranked Results
-- Create SearchAnalytics table for search logging
CREATE TABLE IF NOT EXISTS "SearchAnalytics" (
  "id"           TEXT          NOT NULL,
  "query"        TEXT          NOT NULL,
  "resultsCount" INTEGER       NOT NULL DEFAULT 0,
  "hasFilters"   BOOLEAN       NOT NULL DEFAULT false,
  "ipAddress"    TEXT,
  "createdAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SearchAnalytics_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SearchAnalytics_query_idx"    ON "SearchAnalytics"("query");
CREATE INDEX IF NOT EXISTS "SearchAnalytics_createdAt_idx" ON "SearchAnalytics"("createdAt");

-- Enhance searchVector trigger to also include category name
-- The trigger joins "Category" to get the name, weight: name=A, bio=B, category=C
CREATE OR REPLACE FUNCTION worker_search_vector_update() RETURNS trigger AS $$
DECLARE
  cat_name TEXT;
BEGIN
  SELECT name INTO cat_name FROM "Category" WHERE id = NEW."categoryId";
  NEW."searchVector" := setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'A')
                     || setweight(to_tsvector('simple', coalesce(NEW.bio, '')),  'B')
                     || setweight(to_tsvector('simple', coalesce(cat_name, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-populate existing rows with weighted vectors
UPDATE "Worker" w
SET "searchVector" = setweight(to_tsvector('simple', coalesce(w.name, '')), 'A')
                  || setweight(to_tsvector('simple', coalesce(w.bio,  '')), 'B')
                  || setweight(to_tsvector('simple', coalesce(c.name, '')), 'C')
FROM "Category" c
WHERE c.id = w."categoryId";

DROP TRIGGER IF EXISTS worker_search_vector_trigger ON "Worker";
CREATE TRIGGER worker_search_vector_trigger
  BEFORE INSERT OR UPDATE OF name, bio, "categoryId"
  ON "Worker"
  FOR EACH ROW EXECUTE FUNCTION worker_search_vector_update();
