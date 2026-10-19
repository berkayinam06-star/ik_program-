import { setDefaultResultOrder } from "dns";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Windows often resolves Neon as IPv6 first; Prisma's native engine then
// hangs ~5s per query. Node's pg driver with IPv4-first is fast.
setDefaultResultOrder("ipv4first");

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

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

const url = connectionString();
const isLocal =
  url.includes("localhost") || url.includes("127.0.0.1");

const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(pool),
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
}

export default prisma;
