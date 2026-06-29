import { hash } from "argon2";
import { db } from "../db.js";

const categories = [
  {
    name: "Plumber",
    description: "Pipe fitting, repairs, and water system installations",
    icon: "🔧",
  },
  {
    name: "Electrician",
    description: "Wiring, electrical installations, and repairs",
    icon: "⚡",
  },
  {
    name: "Carpenter",
    description: "Woodwork, furniture making, and framing",
    icon: "🪚",
  },
  {
    name: "Welder",
    description: "Metal fabrication, welding, and structural work",
    icon: "🔩",
  },
  {
    name: "Mason",
    description: "Brickwork, concrete, and stonework",
    icon: "🧱",
  },
  {
    name: "Painter",
    description: "Interior and exterior painting and finishing",
    icon: "🎨",
  },
  {
    name: "Roofer",
    description: "Roof installation, repair, and waterproofing",
    icon: "🏠",
  },
  {
    name: "HVAC Technician",
    description: "Heating, ventilation, and air conditioning systems",
    icon: "❄️",
  },
  {
    name: "Landscaper",
    description: "Garden design, lawn care, and outdoor maintenance",
    icon: "🌿",
  },
  {
    name: "General Contractor",
    description: "Full-service construction and project management",
    icon: "🏗️",
  },
];

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@bluecollar.dev";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;
const CURATOR_EMAIL =
  process.env.SEED_CURATOR_EMAIL ?? "curator@bluecollar.dev";
const CURATOR_PASSWORD = process.env.SEED_CURATOR_PASSWORD;

if (process.env.NODE_ENV === "production") {
  if (!ADMIN_PASSWORD) throw new Error("SEED_ADMIN_PASSWORD is required in production");
  if (!CURATOR_PASSWORD) throw new Error("SEED_CURATOR_PASSWORD is required in production");
}

async function seed() {
  const [adminHash, curatorHash] = await Promise.all([
    hash(ADMIN_PASSWORD),
    hash(CURATOR_PASSWORD),
  ]);

  await db.$transaction([
    db.category.createMany({ data: categories, skipDuplicates: true }),
    db.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: {},
      create: {
        email: ADMIN_EMAIL,
        password: adminHash,
        firstName: "Admin",
        lastName: "User",
        role: "admin",
        verified: true,
      },
    }),
    db.user.upsert({
      where: { email: CURATOR_EMAIL },
      update: {},
      create: {
        email: CURATOR_EMAIL,
        password: curatorHash,
        firstName: "Curator",
        lastName: "User",
        role: "curator",
        verified: true,
      },
    }),
  ]);

  console.log("✅ Seeded categories, admin, and curator.");
  console.log(`   Admin:   ${ADMIN_EMAIL}`);
  console.log(`   Curator: ${CURATOR_EMAIL}`);
}

const reset = process.argv.includes("--reset");

async function main() {
  if (reset) {
    await db.$transaction([
      db.worker.deleteMany(),
      db.user.deleteMany(),
      db.category.deleteMany(),
      db.location.deleteMany(),
    ]);
    console.log("🗑️  Cleared all data.");
  }
  await seed();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
