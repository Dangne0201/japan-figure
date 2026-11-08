import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

dotenv.config({ path: resolve(__dirname, '../../.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
