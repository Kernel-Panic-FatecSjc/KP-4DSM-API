import { plainToInstance } from 'class-transformer';
import { AtualizarAlertaDto } from '../../../src/alertas/dto/atualizar-alerta.dto';
import { camposInformados } from '../../../src/auditoria/campos-informados';

describe('camposInformados', () => {
  it('lista só os campos enviados, ignorando os declarados no DTO que não vieram', () => {
    const dto = plainToInstance(AtualizarAlertaDto, { valorLimite: 40 });

    expect(Object.keys(dto).length).toBeGreaterThan(1);
    expect(camposInformados(dto)).toEqual(['valorLimite']);
  });

  it('mantém campos enviados com valores falsy', () => {
    const dto = plainToInstance(AtualizarAlertaDto, { ativo: false, valorLimite: 0 });

    expect(camposInformados(dto).sort()).toEqual(['ativo', 'valorLimite']);
  });
});
