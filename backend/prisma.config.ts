import "dotenv/config";
import { defineConfig, env } from 'prisma/config';

// Detect if we are running for the local database
const isLocal = process.argv.some(arg => arg.includes('schema.local.prisma'));

export default defineConfig({
  earlyAccess: true,
  schema: isLocal ? './prisma/schema.local.prisma' : './prisma/schema.prisma',
  datasource: { 
    url: isLocal ? (env('LOCAL_DATABASE_URL') || 'file:./erp-market.db') : env('DIRECT_URL'),
  },
});
