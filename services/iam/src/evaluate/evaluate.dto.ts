import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class EvaluateDto {
  @ApiProperty({ example: 'user-uuid' })
  @IsString()
  userId: string;

  @ApiProperty({ example: 'read' })
  @IsString()
  action: string;

  @ApiProperty({ example: 'form' })
  @IsString()
  resource: string;

  @ApiProperty({ example: 'tenant_001', required: false })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ example: 'resource-uuid', required: false })
  @IsOptional()
  @IsString()
  resourceId?: string;
}
