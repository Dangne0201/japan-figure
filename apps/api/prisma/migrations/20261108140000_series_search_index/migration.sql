CREATE INDEX "series_name_trgm_idx"
  ON "series"
  USING GIN (immutable_unaccent(lower("name")) gin_trgm_ops);
