import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEnum, IsObject } from 'class-validator';
import { SubmissionStatus } from '../../schemas/submission.schema';

export class CreateSubmissionDto {
  @ApiProperty({ example: 'form-mongo-id' })
  @IsString() form_id: string;

  @ApiProperty({ example: 1 })
  @IsNumber() form_version: number;

  @ApiProperty({ example: 'tenant_001' })
  @IsString() tenant_id: string;

  @ApiProperty({ example: 'patient_001' })
  @IsString() patient_id: string;

  @ApiProperty({ example: 'doctor_001' })
  @IsString() submitted_by: string;

  @ApiProperty({ required: false, example: 'doctor' })
  @IsOptional()
  @IsString()
  submitted_by_role?: string;

  @ApiProperty({ enum: SubmissionStatus, default: SubmissionStatus.DRAFT })
  @IsOptional()
  @IsEnum(SubmissionStatus)
  status?: SubmissionStatus;

  @ApiProperty({ example: { f1: 'Upper abdominal pain', f2: 7 } })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}

export class UpdateStatusDto {
  @ApiProperty({ enum: [SubmissionStatus.APPROVED, SubmissionStatus.REJECTED] })
  @IsEnum(SubmissionStatus)
  status: SubmissionStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  review_comment?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reviewed_by?: string;

  @ApiProperty({ required: false, example: 'tenant_admin' })
  @IsOptional()
  @IsString()
  reviewed_by_role?: string;
}
