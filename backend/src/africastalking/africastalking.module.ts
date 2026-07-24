import { Global, Module } from '@nestjs/common';
import { AfricasTalkingService } from './africastalking.service';

@Global()
@Module({
  providers: [AfricasTalkingService],
  exports: [AfricasTalkingService],
})
export class AfricasTalkingModule {}
