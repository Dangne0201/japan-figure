import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is required to connect to PostgreSQL.');
    let protocol: string;
    try {
      protocol = new URL(connectionString).protocol;
    } catch {
      throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
    }
    if (protocol !== 'postgres:' && protocol !== 'postgresql:') {
      throw new Error('DATABASE_URL must use the postgres or postgresql protocol.');
    }
    const adapter = new PrismaPg({
      connectionString,
      max: 10,
      connectionTimeoutMillis: 5000,
    });
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
