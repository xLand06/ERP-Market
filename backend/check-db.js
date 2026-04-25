const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DIRECT_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

(async () => {
  try {
    const products = await prisma.product.count();
    const presentations = await prisma.productPresentation.count();
    const categories = await prisma.category.count();
    const branches = await prisma.branch.count();
    console.log('=====================');
    console.log('Cloud DB Status:');
    console.log('  Products:', products);
    console.log('  Presentations:', presentations);
    console.log('  Categories:', categories);
    console.log('  Branches:', branches);
    console.log('=====================');
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
})();