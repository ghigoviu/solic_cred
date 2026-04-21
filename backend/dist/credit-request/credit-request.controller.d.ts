import { CreditRequestService } from './credit-request.service';
import { CreateRequestDto } from './dto/create-request.dto';
export declare class CreditRequestController {
    private readonly service;
    constructor(service: CreditRequestService);
    create(dto: CreateRequestDto): Promise<{
        requestId: string;
        status: string;
    }>;
    findAll(country?: string): Promise<any[]>;
    findOne(id: string): Promise<any>;
    updateStatus(id: string, status: string): Promise<{
        id: string;
        status: string;
    }>;
}
