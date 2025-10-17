import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function unblockAccount(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log(`❌ User with email ${email} not found`);
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lastFailedLogin: null,
        isBlocked: false,
      },
    });

    console.log(`✅ Account ${email} has been unblocked`);
    console.log(`   Failed attempts reset to 0`);
    console.log(`   Block status set to false`);
  } catch (error) {
    console.error("❌ Error unblocking account:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.log("Usage: npm run unblock <email>");
  console.log("Example: npm run unblock test@example.com");
  process.exit(1);
}

unblockAccount(email);
