import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;
  private readonly logger = new Logger(DatabaseService.name);

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'postgres',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || 'credituser',
      password: process.env.DB_PASSWORD || 'SuperSecret',
      database: process.env.DB_NAME || 'credit',
      max: 20,
    });
  }

  async onModuleInit() {
    try {
      await this.pool.query('SELECT 1');
      this.logger.log('Connected to PostgreSQL successfully');
    } catch (error) {
      this.logger.error('Failed to connect to DB on module init', error);
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  /**
   * Ejecuta un query crudo nativo usando el pool de conexiones.
   */
  async query<T = any>(queryText: string, values?: any[]): Promise<T[]> {
    const res = await this.pool.query(queryText, values);
    return res.rows;
  }

  /**
   * Reserva un cliente del pool y lo devuelve para transacciones complejas.
   */
  async getClient(): Promise<PoolClient> {
    const client = await this.pool.connect();
    return client;
  }
}
