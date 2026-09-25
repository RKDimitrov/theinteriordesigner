-- Prisma's bookkeeping table lives in "public", so Supabase exposes it through
-- the Data API. No policies: only Prisma (table owner) can access it.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "_prisma_migrations" FROM anon, authenticated;
