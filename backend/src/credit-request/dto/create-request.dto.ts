import { IsString, IsNumber, IsOptional, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class CustomerDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  docType: string;

  @IsString()
  @IsNotEmpty()
  docNumber: string;

  @IsNumber()
  monthlyIncome: number;
}

export class CreateRequestDto {
  @IsString()
  @IsNotEmpty()
  country: string;

  @ValidateNested()
  @Type(() => CustomerDto)
  customer: CustomerDto;

  @IsNumber()
  amount: number;

  @IsString()
  @IsNotEmpty()
  currency: string;
}
