/**
 * Seed entry point: npm run seed -> this file.
 * Order matters - RBAC (menus/permissions/roles) must exist before the
 * tracker seed can assign a roleId to the owner's TrackerMembership.
 */
import { PrismaClient } from "@prisma/client";
import { seedRbac } from "./rbac";
import { seedTrackerFromExcel } from "./seed-from-excel";

const prisma = new PrismaClient();

async function main() {
  const roleIdByName = await seedRbac();
  const owner = await seedTrackerFromExcel(roleIdByName);

  // Bootstrap: whoever owns the first tracker also gets the global
  // Platform Admin role, so there's at least one account that can manage
  // the System Directory and Roles & Permissions screens.
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: owner.id, roleId: roleIdByName["Platform Admin"] } },
    update: {},
    create: { userId: owner.id, roleId: roleIdByName["Platform Admin"] },
  });

  console.log(`Granted Platform Admin to ${owner.email}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
