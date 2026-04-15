import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AttributesService } from './attributes.service';

class SetAttributeDto {
  @ApiProperty() @IsString() @IsNotEmpty() key: string;
  @ApiProperty() @IsString() @IsNotEmpty() value: string;
}

@ApiTags('User Attributes')
@Controller('users/:userId/attributes')
export class AttributesController {
  constructor(private service: AttributesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all attributes for a user' })
  getAll(@Param('userId') userId: string) {
    return this.service.getUserAttributes(userId);
  }

  @Put()
  @ApiOperation({ summary: 'Set (upsert) a user attribute' })
  set(@Param('userId') userId: string, @Body() dto: SetAttributeDto) {
    return this.service.setUserAttribute(userId, dto.key, dto.value);
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Delete a user attribute' })
  delete(@Param('userId') userId: string, @Param('key') key: string) {
    return this.service.deleteUserAttribute(userId, key);
  }
}
