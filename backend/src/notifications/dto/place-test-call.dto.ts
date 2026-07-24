import { IsNotEmpty, IsString } from 'class-validator';

export class PlaceTestCallDto {
  @IsString()
  @IsNotEmpty()
  to!: string;
}
