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
var CreditRequestService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreditRequestService = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
let CreditRequestService = CreditRequestService_1 = class CreditRequestService {
    constructor(db) {
        this.db = db;
        this.logger = new common_1.Logger(CreditRequestService_1.name);
    }
    async create(dto) {
        const client = await this.db.getClient();
        try {
            await client.query('BEGIN');
            const customerRes = await client.query(`INSERT INTO customer (full_name, encrypted_doc, doc_type, doc_masked, monthly_income)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`, [
                dto.customer.fullName,
                dto.customer.docNumber,
                dto.customer.docType,
                dto.customer.docNumber.substring(0, 4) + '*****',
                dto.customer.monthlyIncome
            ]);
            const customerId = customerRes.rows[0].id;
            const requestRes = await client.query(`INSERT INTO credit_request (country, customer_id, amount, currency)
         VALUES ($1, $2, $3, $4) RETURNING id`, [dto.country, customerId, dto.amount, dto.currency]);
            const requestId = requestRes.rows[0].id;
            await client.query('COMMIT');
            return requestId;
        }
        catch (e) {
            await client.query('ROLLBACK');
            this.logger.error('Failed to create credit request', e);
            throw e;
        }
        finally {
            client.release();
        }
    }
    async findAll(country) {
        let q = `
      SELECT cr.id, cr.status, cr.country, cr.amount, cr.currency, cr.created_at, c.full_name as "customerName"
      FROM credit_request cr
      JOIN customer c ON cr.customer_id = c.id
    `;
        const params = [];
        if (country) {
            q += ` WHERE cr.country = $1`;
            params.push(country);
        }
        q += ` ORDER BY cr.created_at DESC LIMIT 50`;
        return this.db.query(q, params);
    }
    async findOne(id) {
        const req = await this.db.query(`SELECT * FROM credit_request WHERE id = $1`, [id]);
        if (!req.length)
            return null;
        const timeline = await this.db.query(`SELECT * FROM status_timeline WHERE request_id = $1 ORDER BY created_at ASC`, [id]);
        return { ...req[0], timeline };
    }
    async updateStatus(id, newStatus) {
        const res = await this.db.query(`UPDATE credit_request SET status = $1, updated_at = now() WHERE id = $2 RETURNING id`, [newStatus, id]);
        return res.length > 0;
    }
};
exports.CreditRequestService = CreditRequestService;
exports.CreditRequestService = CreditRequestService = CreditRequestService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], CreditRequestService);
//# sourceMappingURL=credit-request.service.js.map