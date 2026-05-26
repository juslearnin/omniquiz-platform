import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

if (!globalForPrisma.prisma) {
  // 1. Establish a standard Node-Postgres connection pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  // 2. Wrap it inside the official Prisma 7 driver adapter
  const adapter = new PrismaPg(pool);

  // 3. Instantiate the client passing the adapter directly
  globalForPrisma.prisma = new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma;
