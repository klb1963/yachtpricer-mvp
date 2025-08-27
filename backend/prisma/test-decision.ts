/* backend/prisma/test-decision.ts */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  let decision = await prisma.pricingDecision.findFirst();
  if (!decision) {
    const yacht = await prisma.yacht.findFirst();
    if (!yacht) {
      console.error('Нет яхт — запусти сидер.');
      return;
    }
    decision = await prisma.pricingDecision.create({
      data: {
        yachtId: yacht.id,
        weekStart: new Date('2025-08-23T00:00:00.000Z'),
        basePrice: 3000,
        status: 'DRAFT',
      },
    });
  }

  const yacht = await prisma.yacht.findUnique({ where: { id: decision.yachtId } });

  console.log('✅ PricingDecision:');
  console.dir(decision, { depth: null });
  console.log('🔗 Related Yacht:');
  console.dir(yacht, { depth: null });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});