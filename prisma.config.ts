import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations must use the direct (non-pooled) Supabase connection.
// The app itself connects through the pooler (DATABASE_URL), see src/server/db.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"],
  },
});
