import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class RiskWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RiskWorkerService.name);
  private timer: NodeJS.Timeout;
  private isProcessing = false;

  constructor(private readonly db: DatabaseService) {}

  onModuleInit() {
    this.logger.log('Starting Risk Worker...');
    this.timer = setInterval(() => this.pollJobs(), 5000);
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  private async pollJobs() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const client = await this.db.getClient();
      try {
        await client.query('BEGIN');
        
        const { rows } = await client.query(
          `SELECT * FROM jobs 
           WHERE queue = 'risk' AND status = 'pending' 
           ORDER BY created_at ASC 
           FOR UPDATE SKIP LOCKED LIMIT 5`
        );

        for (const job of rows) {
          try {
            await this.processJob(job, client);
            await client.query(
              `UPDATE jobs SET status = 'done', processed_at = now() WHERE id = $1`,
              [job.id]
            );
          } catch (e) {
            this.logger.error(`Failed to process job ${job.id}`, e);
            await client.query(
              `UPDATE jobs SET attempts = attempts + 1, status = CASE WHEN attempts >= 4 THEN 'failed' ELSE 'pending' END WHERE id = $1`,
              [job.id]
            );
          }
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    } catch (e) {
      this.logger.error('Error polling jobs', e);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processJob(job: any, client: any) {
    this.logger.log(`Processing risk job for request ${job.payload.id}`);
    
    // Simulate Risk evaluation
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const request = job.payload;
    // Mock logic: If amount > 50000, reject. Otherwise approve.
    const isApproved = request.amount <= 50000;
    const finalStatus = isApproved ? 'APPROVED' : 'REJECTED';

    await client.query(
      `UPDATE credit_request SET status = $1, updated_at = now() WHERE id = $2`,
      [finalStatus, request.id]
    );
    this.logger.log(`Request ${request.id} scored -> ${finalStatus}`);
  }
}
