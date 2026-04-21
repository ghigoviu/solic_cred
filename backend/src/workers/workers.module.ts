import { Module } from '@nestjs/common';
import { RiskWorkerService } from './risk-worker.service';

@Module({
  providers: [RiskWorkerService]
})
export class WorkersModule {}
