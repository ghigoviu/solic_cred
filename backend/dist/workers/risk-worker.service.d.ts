import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
export declare class RiskWorkerService implements OnModuleInit, OnModuleDestroy {
    private readonly db;
    private readonly logger;
    private timer;
    private isProcessing;
    constructor(db: DatabaseService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    private pollJobs;
    private processJob;
}
