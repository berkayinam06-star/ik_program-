/**
 * Prisma seed script — creates demo data for development.
 * Run with: npx prisma db seed
 */

import { setDefaultResultOrder } from "dns";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

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

async function main() {
  console.log("🌱 Seeding database...");

  // Company
  const company = await prisma.company.upsert({
    where: { id: "demo-company-1" },
    update: {},
    create: {
      id:   "demo-company-1",
      name: "Demo Şirketi A.Ş.",
    },
  });

  // Workplaces
  const wp1 = await prisma.workplace.upsert({
    where: { id: "demo-wp-1" },
    update: {},
    create: {
      id:                "demo-wp-1",
      companyId:         company.id,
      name:              "Merkez Ofis",
      sgkRegistrationNo: "12-345678-01",
    },
  });

  const wp2 = await prisma.workplace.upsert({
    where: { id: "demo-wp-2" },
    update: {},
    create: {
      id:                "demo-wp-2",
      companyId:         company.id,
      name:              "Üretim Tesisi",
      sgkRegistrationNo: "12-345678-02",
    },
  });

  // Employees
  const employees = [
    { id: "emp-1", no: "00001", first: "Ahmet",   last: "Yılmaz",  pos: "Yazılım Mühendisi",    wpId: wp1.id },
    { id: "emp-2", no: "00002", first: "Ayşe",    last: "Kaya",    pos: "İK Uzmanı",              wpId: wp1.id },
    { id: "emp-3", no: "00003", first: "Mehmet",  last: "Demir",   pos: "Üretim Operatörü",       wpId: wp2.id },
    { id: "emp-4", no: "00004", first: "Fatma",   last: "Çelik",   pos: "Kalite Kontrol Uzmanı",  wpId: wp2.id },
    { id: "emp-5", no: "00005", first: "Ali",     last: "Şahin",   pos: "Muhasebe Uzmanı",        wpId: wp1.id },
  ];

  for (const emp of employees) {
    await prisma.employee.upsert({
      where: { id: emp.id },
      update: {},
      create: {
        id:          emp.id,
        companyId:   company.id,
        workplaceId: emp.wpId,
        employeeNo:  emp.no,
        firstName:   emp.first,
        lastName:    emp.last,
        position:    emp.pos,
        startDate:   new Date("2023-01-01"),
        status:      "ACTIVE",
      },
    });
  }

  // Sample attendance events for today
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const workDate = new Date(todayStr + "T00:00:00Z");

  // Ahmet: 08:00 IN, 12:00 OUT, 13:00 IN (still working)
  const eventData = [
    { empId: "emp-1", hour: 5, min: 0,  type: "IN"  as const },
    { empId: "emp-1", hour: 9, min: 0,  type: "OUT" as const },
    { empId: "emp-1", hour: 10,min: 0,  type: "IN"  as const },
    { empId: "emp-2", hour: 5, min: 30, type: "IN"  as const },
    { empId: "emp-3", hour: 5, min: 0,  type: "IN"  as const },
    { empId: "emp-3", hour: 9, min: 0,  type: "OUT" as const },
  ];

  for (const ev of eventData) {
    const occurredAt = new Date(today);
    occurredAt.setUTCHours(ev.hour, ev.min, 0, 0);

    await prisma.attendanceEvent.create({
      data: {
        employeeId: ev.empId,
        occurredAt,
        workDate,
        type:   ev.type,
        source: "MANUAL",
        actorId: "seed",
      },
    });
  }

  console.log("✅ Seed completed!");
  console.log(`   Company: ${company.name}`);
  console.log(`   Workplaces: ${wp1.name}, ${wp2.name}`);
  console.log(`   Employees: ${employees.length}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
