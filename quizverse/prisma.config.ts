import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // 💡 Prisma 7 expects the URL to live nested right inside the datasource object!
    url: env("DATABASE_URL"), 
  },
});