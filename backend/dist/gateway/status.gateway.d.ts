import { DatabaseService } from '../database/database.service';
export declare class StatusGateway {
    private readonly db;
    server: any;
    private readonly logger;
    constructor(db: DatabaseService);
    afterInit(): Promise<void>;
    handleConnection(client: any): void;
    handleDisconnect(client: any): void;
    handleJoin(client: any, data: {
        country: string;
    }): {
        event: string;
        data: string;
    };
    private setupPgListen;
}
