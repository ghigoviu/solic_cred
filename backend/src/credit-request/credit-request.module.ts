import { Module } from '@nestjs/common';
import { CreditRequestController } from './credit-request.controller';
import { CreditRequestService } from './credit-request.service';

@Module({
  controllers: [CreditRequestController],
  providers: [CreditRequestService]
})
export class CreditRequestModule {}
