import { PrismaClient } from "@prisma/client";

// Reuse one PrismaClient across hot reloads in dev so each file-save
// doesn't open a fresh pool against Postgres.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
