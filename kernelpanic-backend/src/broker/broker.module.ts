import { Global, Module } from '@nestjs/common';
import { BrokerService } from './broker.service';

@Global()
@Module({
  providers: [BrokerService],
  exports: [BrokerService],
})
export class BrokerModule {}
