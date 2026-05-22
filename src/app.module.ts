import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { UploadFileModule } from './upload-file/upload-file.module';
import { UsersModule } from './users/users.module';
import { ValidationsModule } from './validations/validations.module';
import { RaporScoresModule } from './rapor-scores/rapor-scores.module';
import { CardsModule } from './cards/cards.module';
import { NilaiScoresModule } from './nilai-scores/nilai-scores.module';
import { RankingsModule } from './rankings/rankings.module.js';
import { AnnouncementsModule } from './announcements/announcements.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule,
    UploadFileModule,
    UsersModule,
    ValidationsModule,
    RaporScoresModule,
    CardsModule,
    NilaiScoresModule,
    RankingsModule,
    AnnouncementsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
