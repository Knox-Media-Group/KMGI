import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default demo tenant
  const demoTenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Demo Builder',
      slug: 'demo',
      logoUrl: null,
      primaryColor: '#2563EB',
    },
  });
  console.log('Created demo tenant:', demoTenant.id);

  // Create demo user
  const passwordHash = await bcrypt.hash('demo1234', 10);
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      passwordHash,
    },
  });
  console.log('Created demo user:', demoUser.id);

  // Create membership
  await prisma.membership.upsert({
    where: {
      userId_tenantId: {
        userId: demoUser.id,
        tenantId: demoTenant.id,
      },
    },
    update: {},
    create: {
      userId: demoUser.id,
      tenantId: demoTenant.id,
      role: 'owner',
    },
  });
  console.log('Created membership');

  // Create a second tenant for white-label demo
  const acmeTenant = await prisma.tenant.upsert({
    where: { slug: 'acme' },
    update: {},
    create: {
      name: 'ACME Web Builder',
      slug: 'acme',
      logoUrl: null,
      primaryColor: '#DC2626',
    },
  });
  console.log('Created ACME tenant:', acmeTenant.id);

  console.log('Seeding complete!');
  console.log('');
  console.log('Demo credentials:');
  console.log('  Email: demo@example.com');
  console.log('  Password: demo1234');
  console.log('  Tenant: demo (or acme for different branding)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
