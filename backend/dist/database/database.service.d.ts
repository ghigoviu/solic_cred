import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PoolClient } from 'pg';
export declare class DatabaseService implements OnModuleInit, OnModuleDestroy {
    private pool;
    private readonly logger;
    constructor();
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    query<T = any>(queryText: string, values?: any[]): Promise<T[]>;
    getClient(): Promise<PoolClient>;
}
