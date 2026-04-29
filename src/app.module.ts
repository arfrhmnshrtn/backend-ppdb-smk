import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { UploadFileModule } from './upload-file/upload-file.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [AuthModule, UploadFileModule, UsersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
