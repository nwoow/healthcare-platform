import {
  Controller, Get, Post, Body, Query, HttpCode, HttpStatus, ConflictException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { UsersService } from './users.service';

class InviteUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

@ApiTags('users')
@Controller('auth/users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all users (id, email, isActive, createdAt)' })
  @ApiResponse({ status: 200, description: 'Returns array of users without password hashes' })
  findAll(@Query('tenantId') tenantId?: string) {
    return this.usersService.findAll(tenantId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a user programmatically (called by tenant service)' })
  async createUser(@Body() dto: { email: string; password: string; name?: string; tenantId?: string; role?: string }) {
    try {
      const { passwordHash: _pw, ...user } = await this.usersService.create(dto.email, dto.password, dto.name, dto.tenantId);
      return user;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'P2002') throw new ConflictException(`A user with email ${dto.email} already exists`);
      throw err;
    }
  }

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user account (invite)' })
  @ApiResponse({ status: 201, description: 'Returns the created user without password hash' })
  async invite(@Body() dto: InviteUserDto) {
    try {
      const { passwordHash: _pw, ...user } = await this.usersService.create(
        dto.email,
        dto.password,
      );
      return user;
    } catch (err: unknown) {
      // Prisma unique constraint violation (P2002)
      const code = (err as { code?: string })?.code;
      if (code === 'P2002') {
        throw new ConflictException(`A user with email ${dto.email} already exists`);
      }
      throw err;
    }
  }
}
