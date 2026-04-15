import { IsString, IsNotEmpty, IsOptional } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateTenantDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  subdomain!: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  plan?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  region?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  adminEmail?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  adminName?: string
}
