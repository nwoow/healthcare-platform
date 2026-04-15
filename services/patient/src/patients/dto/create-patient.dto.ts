import { IsString, IsNotEmpty, IsOptional, IsDateString, IsIn } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreatePatientDto {
  @ApiProperty() @IsString() @IsNotEmpty() tenantId: string
  @ApiProperty() @IsString() @IsNotEmpty() name: string
  @ApiProperty() @IsDateString() dob: string
  @ApiProperty() @IsString() @IsIn(['male', 'female', 'other']) gender: string
  @ApiProperty({ required: false }) @IsOptional() @IsString() bloodGroup?: string
  @ApiProperty({ required: false }) @IsOptional() @IsString() contactPhone?: string
  @ApiProperty({ required: false }) @IsOptional() @IsString() contactEmail?: string
  @ApiProperty({ required: false }) @IsOptional() @IsString() assignedDoctorId?: string
}
