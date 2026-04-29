import { Controller, Get, Query } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findByJurusan(@Query('jurusan') jurusan?: string) {
    return this.usersService.findByJurusan(jurusan);
  }
}
