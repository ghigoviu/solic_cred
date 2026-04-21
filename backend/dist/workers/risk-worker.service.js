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
        this.timer = setInterval(() => this.pollJobs(), 10000);
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
        const request = job.payload;
        this.logger.log(`Processing risk job for request ${request.id} (Country: ${request.country})`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        const customerRes = await client.query(`SELECT monthly_income, encode(encrypted_doc, 'escape') as doc, doc_type FROM customer WHERE id = $1`, [request.customer_id]);
        if (!customerRes.rows.length)
            throw new Error("Customer not found");
        const customer = customerRes.rows[0];
        const doc = customer.doc.toString();
        const monthlyIncome = Number(customer.monthly_income);
        const amount = Number(request.amount);
        let isApproved = true;
        let reason = "ALL_RULES_PASSED";
        if (request.country === 'MX') {
            if (!doc || doc.trim() === '') {
                isApproved = false;
                reason = "CURP_MISSING";
            }
            else if (!/^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9]{2}$/i.test(doc)) {
                isApproved = false;
                reason = "CURP_INVALID_FORMAT";
            }
            else if (amount > monthlyIncome * 12) {
                isApproved = false;
                reason = "AMOUNT_EXCEEDS_12_MONTHS";
            }
        }
        else if (request.country === 'CO') {
            if (!doc || doc.trim() === '') {
                isApproved = false;
                reason = "CC_MISSING";
            }
            else {
                const totalDebt = Math.random() * (monthlyIncome * 2);
                if (totalDebt >= monthlyIncome * 0.7) {
                    isApproved = false;
                    reason = "DEBT_TOO_HIGH";
                }
            }
        }
        else if (request.country === 'BR') {
            if (!doc || doc.trim() === '') {
                isApproved = false;
                reason = "CPF_MISSING";
            }
            else if (doc.length !== 11) {
                isApproved = false;
                reason = "CPF_INVALID";
            }
            else {
                const score = Math.floor(Math.random() * 550) + 300;
                if (score < 600) {
                    isApproved = false;
                    reason = "SCORE_TOO_LOW";
                }
            }
        }
        const finalStatus = isApproved ? 'APPROVED' : 'REJECTED';
        const bankInfo = { reason, evaluatedAt: new Date().toISOString() };
        await client.query(`UPDATE credit_request SET status = $1, bank_info = $2, updated_at = now() WHERE id = $3`, [finalStatus, JSON.stringify(bankInfo), request.id]);
        await client.query(`UPDATE status_timeline SET comment = $1 WHERE request_id = $2 AND to_status = $3`, [reason, request.id, finalStatus]);
        this.logger.log(`Request ${request.id} scored -> ${finalStatus} (Reason: ${reason})`);
    }
};
exports.RiskWorkerService = RiskWorkerService;
exports.RiskWorkerService = RiskWorkerService = RiskWorkerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], RiskWorkerService);
//# sourceMappingURL=risk-worker.service.js.map