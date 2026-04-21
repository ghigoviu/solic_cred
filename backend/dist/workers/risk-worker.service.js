"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var RiskWorkerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskWorkerService = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
let RiskWorkerService = RiskWorkerService_1 = class RiskWorkerService {
    constructor(db) {
        this.db = db;
        this.logger = new common_1.Logger(RiskWorkerService_1.name);
        this.isProcessing = false;
    }
    onModuleInit() {
        this.logger.log('Starting Risk Worker...');
        this.timer = setInterval(() => this.pollJobs(), 5000);
    }
    onModuleDestroy() {
        clearInterval(this.timer);
    }
    async pollJobs() {
        if (this.isProcessing)
            return;
        this.isProcessing = true;
        try {
            const client = await this.db.getClient();
            try {
                await client.query('BEGIN');
                const { rows } = await client.query(`SELECT * FROM jobs 
           WHERE queue = 'risk' AND status = 'pending' 
           ORDER BY created_at ASC 
           FOR UPDATE SKIP LOCKED LIMIT 5`);
                for (const job of rows) {
                    try {
                        await this.processJob(job, client);
                        await client.query(`UPDATE jobs SET status = 'done', processed_at = now() WHERE id = $1`, [job.id]);
                    }
                    catch (e) {
                        this.logger.error(`Failed to process job ${job.id}`, e);
                        await client.query(`UPDATE jobs SET attempts = attempts + 1, status = CASE WHEN attempts >= 4 THEN 'failed' ELSE 'pending' END WHERE id = $1`, [job.id]);
                    }
                }
                await client.query('COMMIT');
            }
            catch (e) {
                await client.query('ROLLBACK');
            }
            finally {
                client.release();
            }
        }
        catch (e) {
            this.logger.error('Error polling jobs', e);
        }
        finally {
            this.isProcessing = false;
        }
    }
    async processJob(job, client) {
        this.logger.log(`Processing risk job for request ${job.payload.id}`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        const request = job.payload;
        const isApproved = request.amount <= 50000;
        const finalStatus = isApproved ? 'APPROVED' : 'REJECTED';
        await client.query(`UPDATE credit_request SET status = $1, updated_at = now() WHERE id = $2`, [finalStatus, request.id]);
        this.logger.log(`Request ${request.id} scored -> ${finalStatus}`);
    }
};
exports.RiskWorkerService = RiskWorkerService;
exports.RiskWorkerService = RiskWorkerService = RiskWorkerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], RiskWorkerService);
//# sourceMappingURL=risk-worker.service.js.map