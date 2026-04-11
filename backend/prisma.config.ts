import "dotenv/config";
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: './prisma/schema.prisma',
  datasource: { 
    url: env('DIRECT_URL'), // Use Direct URL for CLI commands to avoid PgBouncer issues
  },
});
