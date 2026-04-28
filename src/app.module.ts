import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { UploadFileModule } from './upload-file/upload-file.module';

@Module({
  imports: [AuthModule, UploadFileModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
