import { IsString, Matches } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class LinkAbhaDto {
  @ApiProperty({ description: '14-digit ABHA number', example: '12345678901234' })
  @IsString()
  @Matches(/^\d{14}$/, { message: 'ABHA number must be exactly 14 digits' })
  abhaNumber: string

  @ApiProperty({ description: 'ABHA address in X@abdm format', example: 'ravi@abdm' })
  @IsString()
  @Matches(/^[a-zA-Z0-9._]+@abdm$/, { message: 'ABHA address must be in X@abdm format' })
  abhaAddress: string
}
