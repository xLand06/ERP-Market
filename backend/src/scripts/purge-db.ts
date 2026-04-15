import { prisma } from '../config/prisma';

async function main() {
  console.log('--- Database Purge Started ---');
  
  try {
    // Orders matter due to foreign keys if any
    console.log('Cleaning BranchInventory...');
    await prisma.branchInventory.deleteMany({});
    
    console.log('Cleaning Transactions...');
    await prisma.transaction.deleteMany({});
    
    console.log('Cleaning AuditLogs...');
    await prisma.auditLog.deleteMany({});

    console.log('Cleaning Products...');
    await prisma.product.deleteMany({});

    console.log('Cleaning Categories...');
    await prisma.category.deleteMany({});
    
    console.log('--- Database Purge Completed Successfully ---');
  } catch (error) {
    console.error('Error during purge:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
