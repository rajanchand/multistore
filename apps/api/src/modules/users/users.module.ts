import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { RolesController } from '../roles/roles.controller';

@Module({
  providers: [UsersService],
  controllers: [UsersController, RolesController],
  exports: [UsersService],
})
export class UsersModule {}
