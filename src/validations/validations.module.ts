import { Module } from '@nestjs/common';
import { ValidationsService } from './validations.service';
import { ValidationsController } from './validations.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ValidationsController],
  providers: [ValidationsService],
  exports: [ValidationsService],
})
export class ValidationsModule {}
