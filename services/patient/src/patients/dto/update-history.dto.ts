import { IsObject, IsOptional } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
export class UpdateHistoryDto {
  @ApiProperty() @IsOptional() @IsObject() historyFlags: Record<string, unknown>
}
