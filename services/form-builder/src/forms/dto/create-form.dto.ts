import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ValidateNested, IsBoolean, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class FieldOptionDto {
  @IsString() label: string;
  @IsString() value: string;
}

export class FormFieldDto {
  @IsString() id: string;
  @IsString() type: string;
  @IsString() label: string;
  @IsOptional() @IsString() placeholder?: string;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsString() helpText?: string;
  @IsOptional() @IsNumber() min?: number;
  @IsOptional() @IsNumber() max?: number;
  @IsOptional() @IsArray() options?: FieldOptionDto[];
}

export class FormSectionDto {
  @IsString() id: string;
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => FormFieldDto) fields?: FormFieldDto[];
}

export class ConditionalLogicDto {
  @IsString() id: string;
  @IsString() fieldId: string;
  @IsString() operator: string;
  @IsString() value: string;
  @IsString() action: string;
  @IsString() targetId: string;
}

export class AccessControlDto {
  @IsOptional() @IsArray() roles?: string[];
  @IsOptional() attributes?: Record<string, any>;
}

export class CreateFormDto {
  @ApiProperty({ example: 'Gastro Consultation' })
  @IsString() name: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString() description?: string;

  @ApiProperty({ example: 'tenant_001' })
  @IsString() tenant_id: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString() specialty?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => FormSectionDto) sections?: FormSectionDto[];

  @ApiProperty({ required: false })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ConditionalLogicDto) conditional_logic?: ConditionalLogicDto[];

  @ApiProperty({ required: false })
  @IsOptional() @ValidateNested() @Type(() => AccessControlDto) access_control?: AccessControlDto;

  @ApiProperty({ required: false, enum: ['wizard', 'accordion', 'tabs'] })
  @IsOptional() @IsString() layoutType?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString() created_by?: string;
}
