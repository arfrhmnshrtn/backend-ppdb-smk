import { Module } from '@nestjs/common';
import { UploadFileService } from './upload-file.service';
import { UploadFileController } from './upload-file.controller';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ValidationsModule } from '../validations/validations.module';

@Module({
  imports: [
    ValidationsModule,
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/files',
    }),
  ],
  controllers: [UploadFileController],
  providers: [UploadFileService],
})
export class UploadFileModule {}
