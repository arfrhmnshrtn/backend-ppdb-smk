import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { user_role } from '../../generated/prisma/client';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findByJurusan(@Query('jurusan') jurusan?: string) {
    return this.usersService.findByJurusan(jurusan);
  }

  @Get('registration-status')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(user_role.USER)
  getRegistrationStatus(@Req() req: Request & { user: { sub: number; role: string } }) {
    const userId = req.user.sub;
    return this.usersService.getRegistrationStatus(userId);
  }
}
