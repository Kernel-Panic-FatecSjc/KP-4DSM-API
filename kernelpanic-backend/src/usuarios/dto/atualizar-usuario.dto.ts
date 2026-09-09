import { IsEmail, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class AtualizarUsuarioDto {
  @IsOptional()
  @IsNotEmpty()
  nome?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @MinLength(8)
  senha?: string;
}
