import { DatabaseService } from '../database/database.service';
import { CreateRequestDto } from './dto/create-request.dto';
export declare class CreditRequestService {
    private readonly db;
    private readonly logger;
    constructor(db: DatabaseService);
    create(dto: CreateRequestDto): Promise<string>;
    findAll(country: string): Promise<any[]>;
    findOne(id: string): Promise<any>;
    updateStatus(id: string, newStatus: string): Promise<boolean>;
}
