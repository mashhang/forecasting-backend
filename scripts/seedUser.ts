// scripts/seedUser.ts
import { PrismaClient } from "../generated/prisma";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("password123", 10);

  const user = await prisma.user.create({
    data: {
      email: "test@example.com",
      name: "Test User",
      password: hashedPassword,
      role: "STAFF", // or "STAFF"
    },
  });

  console.log("Created user:", user);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
