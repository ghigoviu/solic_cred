import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateRequestDto } from './dto/create-request.dto';

@Injectable()
export class CreditRequestService {
  private readonly logger = new Logger(CreditRequestService.name);

  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateRequestDto): Promise<string> {
    const client = await this.db.getClient();
    try {
      await client.query('BEGIN');
      
      // Simulating "pgcrypto" implicitly - normally we'd use pg function.
      // E.g. encrypted_doc = pgp_sym_encrypt($1, $2)
      // For MVP, we insert standard bytea text via literal cast or keep it simplified.
      const customerRes = await client.query(
        `INSERT INTO customer (full_name, encrypted_doc, doc_type, doc_masked, monthly_income)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          dto.customer.fullName,
          dto.customer.docNumber, // NOT safe for production, MVP only
          dto.customer.docType,
          dto.customer.docNumber.substring(0, 4) + '*****',
          dto.customer.monthlyIncome
        ]
      );
      
      const customerId = customerRes.rows[0].id;
      
      const requestRes = await client.query(
        `INSERT INTO credit_request (country, customer_id, amount, currency)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [dto.country, customerId, dto.amount, dto.currency]
      );
      
      const requestId = requestRes.rows[0].id;
      
      await client.query('COMMIT');
      return requestId;
    } catch (e) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to create credit request', e);
      throw e;
    } finally {
      client.release();
    }
  }

  async findAll(country: string) {
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

  async findOne(id: string) {
    const req = await this.db.query(`SELECT * FROM credit_request WHERE id = $1`, [id]);
    if (!req.length) return null;
    
    const timeline = await this.db.query(`SELECT * FROM status_timeline WHERE request_id = $1 ORDER BY created_at ASC`, [id]);
    return { ...req[0], timeline };
  }

  async updateStatus(id: string, newStatus: string) {
    const res = await this.db.query(
      `UPDATE credit_request SET status = $1, updated_at = now() WHERE id = $2 RETURNING id`,
      [newStatus, id]
    );
    return res.length > 0;
  }
}
