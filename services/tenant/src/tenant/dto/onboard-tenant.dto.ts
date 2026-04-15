import { IsString, IsOptional, IsEmail } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class OnboardTenantDto {
  @ApiProperty() @IsString() name: string
  @ApiProperty() @IsString() subdomain: string
  @ApiProperty({ required: false }) @IsOptional() @IsString() plan?: string
  @ApiProperty({ required: false }) @IsOptional() @IsString() region?: string
  @ApiProperty({ required: false }) @IsOptional() @IsString() hospitalType?: string
  @ApiProperty({ required: false }) @IsOptional() @IsEmail() adminEmail?: string
  @ApiProperty({ required: false }) @IsOptional() @IsString() adminName?: string
}

export class UpdateStatusDto {
  @ApiProperty() @IsString() status: string
}
