import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'maria.souza@orgao.gov.br', description: 'Email cadastrado.' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'senha-segura-123', description: 'Senha do usuário.' })
  @IsString()
  senha!: string;
}
