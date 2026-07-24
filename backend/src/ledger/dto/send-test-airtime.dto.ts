import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class SendTestAirtimeDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;

  @IsInt()
  @IsPositive()
  amountNaira!: number;
}
