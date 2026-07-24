import { IsNotEmpty, IsString } from 'class-validator';

export class SendTestSmsDto {
  @IsString()
  @IsNotEmpty()
  to!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;
}
