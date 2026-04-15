import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsObject } from 'class-validator';
import { PoliciesService } from './policies.service';

class CreatePolicyDto {
  @ApiProperty() @IsString() @IsNotEmpty() resourceType: string;
  @ApiProperty() @IsString() @IsNotEmpty() resourceId: string;
  @ApiProperty({ type: Object }) @IsObject() attributeConditions: Record<string, unknown>;
}

class UpdatePolicyDto {
  @ApiProperty({ type: Object }) @IsObject() attributeConditions: Record<string, unknown>;
}

@ApiTags('Resource Policies')
@Controller('policies')
export class PoliciesController {
  constructor(private service: PoliciesService) {}

  @Get()
  @ApiOperation({ summary: 'List resource policies' })
  @ApiQuery({ name: 'resourceType', required: false })
  findAll(@Query('resourceType') resourceType?: string) {
    return this.service.findAll(resourceType);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single resource policy' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a resource policy' })
  create(@Body() dto: CreatePolicyDto) {
    return this.service.create(dto.resourceType, dto.resourceId, dto.attributeConditions);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a resource policy' })
  update(@Param('id') id: string, @Body() dto: UpdatePolicyDto) {
    return this.service.update(id, dto.attributeConditions);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a resource policy' })
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
