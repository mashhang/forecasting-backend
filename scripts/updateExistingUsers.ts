import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function updateExistingUsers() {
  try {
    console.log('Updating existing users to have firstLogin: true...');
    
    // First, let's see what the current state is
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        firstLogin: true,
      },
    });

    console.log('\nCurrent users and their firstLogin status:');
    allUsers.forEach(user => {
      console.log(`${user.name} (${user.email}): firstLogin = ${user.firstLogin}`);
    });

    // Update all users to have firstLogin: true (this will force them to change password)
    const result = await prisma.user.updateMany({
      data: {
        firstLogin: true,
      },
    });

    console.log(`\nUpdated ${result.count} users to have firstLogin: true`);

    // Show updated users and their firstLogin status
    const updatedUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        firstLogin: true,
      },
    });

    console.log('\nUpdated users and their firstLogin status:');
    updatedUsers.forEach(user => {
      console.log(`${user.name} (${user.email}): firstLogin = ${user.firstLogin}`);
    });

  } catch (error) {
    console.error('Error updating users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateExistingUsers();
