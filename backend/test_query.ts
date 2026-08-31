import { prisma } from './src/config/prisma';

async function test() {
    try {
        console.log('Testing product query with expectedSpoilagePercent...');
        const products = await prisma.product.findMany({
            select: {
                id: true,
                name: true,
                expectedSpoilagePercent: true
            },
            take: 1
        });
        console.log('Success! Product:', JSON.stringify(products[0], null, 2));
    } catch (error) {
        console.error('Error during test:', error);
    }
}

test();
