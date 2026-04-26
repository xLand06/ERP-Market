import { prisma } from '../config/prisma';

async function main() {
  console.log('--- Database Purge Started ---');
  
  try {
    console.log('Cleaning BranchInventory...');
    await prisma.branchInventory.deleteMany({});
    
    console.log('Cleaning Transactions...');
    await prisma.transaction.deleteMany({});
    
    console.log('Cleaning AuditLogs...');
    await prisma.auditLog.deleteMany({});

    console.log('Cleaning Products...');
    await prisma.product.deleteMany({});

    console.log('Cleaning SubGroups...');
    await prisma.subGroup.deleteMany({});
    
    console.log('Cleaning Groups...');
    await prisma.group.deleteMany({});
    
    console.log('--- Database Purge Completed Successfully ---');
  } catch (error) {
    console.error('Error during purge:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();