/* backend/prisma/test-decision.ts */

import { PrismaClient, DecisionStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Берём первую яхту
    const yacht = await prisma.yacht.findFirst();
    if (!yacht) {
        console.error('⛔ Нет яхт в базе, сначала запусти seed.ts');
        return;
    }

    console.log('🚤 Yacht found:', yacht.name, yacht.id);

    // Создаём PricingDecision (upsert на всякий случай)
    const decision = await prisma.pricingDecision.upsert({
        where: {
            yachtId_weekStart: {
                yachtId: yacht.id,
                weekStart: new Date('2025-08-23'),
            },
        },
        create: {
            yachtId: yacht.id,
            weekStart: new Date('2025-08-23'),
            basePrice: 3000,
            status: DecisionStatus.DRAFT,
        },
        update: {},
        include: { yacht: true }, // 👈 вот ключевой момент
    });

    console.log('✅ PricingDecision with yacht:');
    console.dir(decision, { depth: null });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });