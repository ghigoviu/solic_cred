import { Module } from '@nestjs/common';
import { CreditRequestModule } from './credit-request/credit-request.module';
import { RulesModule } from './rules/rules.module';
import { WorkersModule } from './workers/workers.module';
import { GatewayModule } from './gateway/gateway.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    DatabaseModule,
    CreditRequestModule,
    RulesModule,
    WorkersModule,
    GatewayModule
  ]
})
export class AppModule {}
