import { Controller, Get, Post, Body, Delete, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { AppService } from './app.service';

class CreatePostgresNoteDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content: string;
}

class CreateMongoLogDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  details: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  source?: string;
}

@ApiTags('Boilerplate')
@Controller('boilerplate')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('notes')
  @ApiOperation({ summary: 'Get all Postgres notes' })
  getNotes() {
    return this.appService.getAllPostgresNotes();
  }

  @Post('notes')
  @ApiOperation({ summary: 'Create a Postgres note' })
  createNote(@Body() dto: CreatePostgresNoteDto) {
    return this.appService.createPostgresNote(dto);
  }

  @Delete('notes/:id')
  @ApiOperation({ summary: 'Delete a Postgres note' })
  deleteNote(@Param('id') id: string) {
    return this.appService.deletePostgresNote(id);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get all Mongo logs' })
  getLogs() {
    return this.appService.getAllMongoLogs();
  }

  @Post('logs')
  @ApiOperation({ summary: 'Create a Mongo log' })
  createLog(@Body() dto: CreateMongoLogDto) {
    return this.appService.createMongoLog(dto);
  }

  @Delete('logs/:id')
  @ApiOperation({ summary: 'Delete a Mongo log' })
  deleteLog(@Param('id') id: string) {
    return this.appService.deleteMongoLog(id);
  }
}
