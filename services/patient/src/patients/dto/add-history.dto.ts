import { IsString, IsNotEmpty, IsOptional, IsDateString, IsArray } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class AddHistoryDto {
  @ApiProperty() @IsDateString() visitDate: string
  @ApiProperty() @IsString() @IsNotEmpty() doctorId: string
  @ApiProperty() @IsString() @IsNotEmpty() diagnosis: string
  @ApiProperty({ required: false, type: [String] }) @IsOptional() @IsArray() medications?: string[]
  @ApiProperty({ required: false }) @IsOptional() vitals?: Record<string, unknown>
  @ApiProperty({ required: false }) @IsOptional() notes?: string
}
