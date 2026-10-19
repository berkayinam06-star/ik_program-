import { setDefaultResultOrder } from "dns";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

setDefaultResultOrder("ipv4first");

function connectionString() {
  const raw = process.env.DATABASE_URL ?? "";
  try {
    const parsed = new URL(raw);
    parsed.searchParams.delete("channel_binding");
    return parsed.toString();
  } catch {
    return raw;
  }
}
const pool = new Pool({
  connectionString: connectionString(),
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function checkOrSeedAdmin() {
  const users = await prisma.user.findMany();
  console.log("Current users in DB:", users.map(u => ({ email: u.email, role: u.role, name: u.name })));

  if (users.length === 0) {
    console.log("No users found. Creating default admin and personel users...");
    const adminPasswordHash = await bcrypt.hash("admin123", 10);
    const admin = await prisma.user.create({
      data: {
        email: "admin@ik.com",
        passwordHash: adminPasswordHash,
        name: "Sistem Yöneticisi",
        role: "admin",
      },
    });
    console.log("Created admin user: admin@ik.com / admin123");

    // Also link a demo personel user if employee exists
    const employee = await prisma.employee.findFirst({ where: { isDeleted: false } });
    if (employee) {
      const personelPasswordHash = await bcrypt.hash("personel123", 10);
      const personelUser = await prisma.user.create({
        data: {
          email: "personel@ik.com",
          passwordHash: personelPasswordHash,
          name: `${employee.firstName} ${employee.lastName}`,
          role: "personel",
          employeeId: employee.id,
        },
      });
      console.log(`Created personel user: personel@ik.com / personel123 (Linked to ${employee.firstName} ${employee.lastName})`);
    }
  }
}

checkOrSeedAdmin()
  .catch(console.error)
  .finally(() => pool.end());
