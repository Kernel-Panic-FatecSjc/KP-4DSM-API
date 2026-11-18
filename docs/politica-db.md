# **Política de Banco de Dados — DATA PANIC**

> Cópia da página **Banco de dados** da wiki, que é a versão de referência. Ao mudar uma, mude a outra no mesmo dia.

![Diagrama do modelo de dados do projeto](images/Modelo-de-dados.jpg)

## **Objetivo**

A estrutura do banco de dados evolui junto com a aplicação. Para garantir que essa evolução ocorra de forma segura, rastreável e compatível com os ambientes de Desenvolvimento, Staging e Produção, adotamos a abordagem de **Banco de Dados como Código (Database as Code)**, gerenciado por meio do Prisma e sujeito às mesmas regras de qualidade, Definition of Ready (DoR), Definition of Done (DoD) e Code Review aplicadas às demais tarefas técnicas.

O `schema.prisma` e as migrations versionadas no repositório são as principais fontes de referência para a estrutura e o histórico de alterações do banco. Objetos específicos do PostgreSQL, como triggers e funções, também devem ser mantidos sob versionamento e revisão.

Este documento estabelece as regras de negócio, os padrões técnicos, os controles de segurança e os procedimentos necessários para garantir a integridade, a disponibilidade e a rastreabilidade dos dados.

## 1. Banco de Dados e Ferramental

### 1.1. Tecnologia adotada

* **Banco de dados:** PostgreSQL com a extensão PostGIS. O PostgreSQL foi escolhido por ser um sistema de gerenciamento de banco de dados relacional de código aberto e gratuito, sem custos de licenciamento, oferecendo confiabilidade, segurança, integridade dos dados e suporte a consultas complexas. Sua ampla adoção e documentação facilitam o desenvolvimento, a manutenção e a evolução do sistema.
* **Extensão geográfica:** PostGIS, utilizada para armazenar, manipular e consultar dados geográficos, como coordenadas e posições geoespaciais. A extensão oferece recursos específicos para operações espaciais, permitindo maior precisão e eficiência no processamento das leituras geográficas do sistema.
* **ORM e migrations:** Prisma, utilizado para definir o schema, padronizar o acesso aos dados e gerenciar as migrations. Essa abordagem facilita o versionamento das alterações estruturais e mantém a evolução do banco organizada e rastreável.
* **SQL personalizado:** utilizado quando necessário para implementar recursos específicos do PostgreSQL e do PostGIS que não são representados integralmente pelo Prisma, incluindo triggers, funções, índices espaciais e consultas especializadas.
* **Ambiente local:** banco disponibilizado via Docker Compose, garantindo uma configuração padronizada e reproduzível entre os ambientes de desenvolvimento.
* **Versionamento:** schema, migrations, scripts auxiliares e demais objetos SQL devem ser versionados no repositório do projeto, permitindo rastrear alterações, revisar modificações e reconstruir a estrutura do banco de forma consistente.

### 1.2. Padronização dos ambientes

As versões do PostgreSQL, PostGIS, Prisma e das dependências relevantes devem ser fixadas e documentadas para reduzir incompatibilidades entre os ambientes de Desenvolvimento, Staging e Produção.

O versionamento do banco possui duas partes distintas, que devem ser controladas no repositório:

1. **Versão do mecanismo e ferramentas:** fixar a imagem PostgreSQL/PostGIS usada em desenvolvimento e CI (tag explícita, nunca `latest`), registrar a versão do Prisma nas dependências e manter os arquivos de lock. Uma atualização de PostgreSQL, PostGIS ou Prisma exige uma tarefa técnica, avaliação de compatibilidade, teste de migrations e revisão antes de ser adotada nos ambientes compartilhados.
2. **Versão do schema:** o `prisma/schema.prisma` representa o estado desejado atual; cada mudança estrutural é uma nova migration em `prisma/migrations/`, com nome descritivo e timestamp gerado pelo Prisma. Migrations aplicadas em ambiente compartilhado são imutáveis. Correções e mudanças posteriores entram em novas migrations, preservando o histórico necessário para recriar o banco desde o estado inicial.

O número da versão do mecanismo não substitui o histórico de migrations: devem ser registrados e verificáveis tanto a versão do PostgreSQL/PostGIS em execução quanto as migrations aplicadas em cada ambiente. Não se deve atualizar a imagem de banco de um ambiente sem primeiro validar a compatibilidade da aplicação, das extensões e do conjunto completo de migrations.

A pipeline de CI deve utilizar uma configuração compatível com a versão do banco prevista para o ambiente de destino, executando os testes necessários para verificar a integridade do schema, das migrations e das funcionalidades dependentes de recursos geográficos.

Atualizações dessas dependências devem ser tratadas como mudanças técnicas, com testes e revisão antes da implantação.

**Como está hoje:** desenvolvimento (`docker-compose.yml`) e CI (`ci.yaml` e suíte noturna) usam a mesma imagem, `postgis/postgis:16-3.4` (PostgreSQL 16, PostGIS 3.4), com tag fixa; a versão do Prisma está travada no `package-lock.json`. A imagem vale só para desenvolvimento e CI. **Na VM** (pré-release e produção) o banco não roda em Docker: a versão instalada de PostgreSQL e PostGIS deve ser registrada por ambiente, e o deploy imprime no resumo as versões de PostgreSQL, PostGIS e Prisma em uso (previsto no Roadmap DevOps (wiki), Fase 4).

### 1.3. Manutenção e integridade do banco

A manutenção do banco de dados deve seguir práticas que garantam a disponibilidade, a integridade, a segurança e o desempenho das operações.

* **Migrations controladas:** toda alteração estrutural deve ser registrada por meio de migrations versionadas, evitando modificações manuais não documentadas nos ambientes compartilhados.
* **Backups e recuperação:** devem ser estabelecidas rotinas de backup e procedimentos de restauração testados periodicamente, reduzindo o risco de perda de dados.
* **Monitoramento e desempenho:** consultas lentas, consumo de recursos, índices e crescimento do banco devem ser acompanhados para identificar gargalos e orientar otimizações.
* **Integridade dos dados:** restrições, chaves estrangeiras e validações devem ser utilizadas para evitar inconsistências e preservar os relacionamentos entre as entidades.
* **Índices e dados geográficos:** índices convencionais e espaciais devem ser definidos conforme os padrões de consulta, especialmente para operações geográficas realizadas pelo PostGIS.
* **Segurança e permissões:** o acesso deve seguir o princípio do menor privilégio, com credenciais protegidas e permissões específicas para cada ambiente e função.
* **Evolução do schema:** mudanças devem considerar a compatibilidade com a aplicação, o volume de dados existente e os possíveis impactos durante a implantação.

Essas práticas visam facilitar a manutenção contínua, reduzir riscos operacionais e garantir que o banco possa evoluir junto com o projeto.

### 1.4. Papéis e Limites de Atuação

A integridade do banco de dados depende do controle estrito de quem possui autorização para alterar sua estrutura:

* **Durante o Desenvolvimento e Manutenção Evolutiva:** Apenas os desenvolvedores autorizados da equipe **Kernel Panic** têm permissão para criar, alterar ou excluir estruturas do banco de dados (tabelas, colunas, triggers, índices). Toda mudança obrigatoriamente passa pela esteira de CI/CD.
* **Pós-Entrega (Equipe de Infraestrutura/Cliente):** A equipe de infraestrutura ou do cliente **não deve** realizar alterações estruturais, rodar SQLs manuais (DDL) ou aplicar migrations por conta própria. O acesso concedido a eles é estritamente operacional: monitoramento de instâncias, execução de rotinas de backup/restore e reinicialização de serviços. O versionamento e a evolução do banco pós-entrega continuam seguindo o fluxo de código da Kernel Panic.

### 1.5. Arquitetura e Desacoplamento do Banco de Dados

O banco de dados é um detalhe de infraestrutura e não deve ditar a implementação das regras de negócio. O projeto não "promete" um banco PostgreSQL para as regras de negócio centrais.

* **Repository Pattern (Portas e Adaptadores): meta com migração gradual.** A regra de negócio deve depender de uma interface (ex.: `IAlertasRepository`), e a implementação com Prisma fica na camada de infraestrutura. Isso permite testar a regra sem banco real e trocar a tecnologia depois.
* **Situação atual:** a regra ainda não é cumprida. 18 services injetam o `PrismaService` diretamente e não existe nenhum `I*Repository`. Até a equipe decidir se isso vira regra obrigatória (decisão pendente no Roadmap DevOps (wiki)), vale: código novo não aumenta o acoplamento sem justificar no PR, e a migração dos services existentes é feita por tarefa, um módulo por vez. A trava automática (lint que barra `PrismaService` em service novo, com lista de exceções para os atuais) está no roadmap.

## **2. Modelo de Dados e Regras de Negócio**

O schema define a estrutura dos dados, mas as regras de negócio e o significado das entidades devem permanecer documentados.

### **2.1. Vocabulário do domínio**

O time deve preservar a distinção entre os seguintes conceitos:

* **LeituraBruta:** informação original enviada pelo dispositivo, preservada para rastreabilidade.
* **Medida:** dado processado e reconhecido pelo sistema como válido.
* **Alerta:** regra ou configuração que determina uma condição a ser monitorada.
* **Alarme:** ocorrência gerada quando uma condição configurada é identificada.

Alterações nessas entidades devem considerar os impactos sobre a ingestão, o processamento, a auditoria e os consumidores dos dados.

### **2.2. Regras de negócio executadas no banco**

A avaliação de alertas ocorre por meio da trigger PostgreSQL `trg_avaliar_alertas_lote`, e não exclusivamente na camada NestJS.

Consequentemente:

* Mudanças nessa regra exigem revisão do SQL envolvido.
* Os testes de integração devem validar o comportamento da trigger.
* A revisão deve considerar a consistência dos dados, os efeitos colaterais e o desempenho.
* Alterações na estrutura das tabelas relacionadas devem preservar a compatibilidade com a trigger.
* A ausência, falha ou comportamento incorreto da trigger deve ser detectado pelos testes automatizados pertinentes.

Objetos SQL críticos devem ter sua criação, alteração e remoção registradas em migrations versionadas.

### 2.3. Normalização e Formatação de Dados

O fato de utilizarmos o Prisma não isenta o modelo de seguir as regras formais de design de banco de dados relacional.

* **Regra Formativa (3FN - Terceira Forma Normal):** O modelo deve ser construído, no mínimo, visando a 3ª Forma Normal. Todo atributo não-chave deve depender única e exclusivamente da chave primária da tabela.
* **O Porquê:** Essa normalização é exigida para eliminar a redundância de dados (ex: repetir o nome do órgão ou estação em cada leitura) e prevenir anomalias de inserção, atualização e exclusão, garantindo a integridade referencial que a aplicação de alta carga exige. Redundâncias intencionais para fins de histórico (snapshots) devem ser estritamente documentadas.

### 2.4. Carga Inicial de Dados (Database Seeding)

O modelo de dados vazio (apenas as tabelas) não é suficiente para validar a aplicação ou disponibilizá-la para a equipe de infraestrutura. A aplicação exige uma massa de dados mínima para iniciar, realizar testes operacionais e homologar fluxos.

* **Seed de Bootstrap:** A aplicação deve possuir um script automatizado (`db:seed`) que injete a carga mínima obrigatória para o sistema funcionar (usuários administradores, configurações padrão, domínios e parâmetros essenciais).
* **Seed de Testes (Mock):** Deve existir uma carga de dados robusta gerada automaticamente para popular ambientes de desenvolvimento, validação das telas e, principalmente, para viabilizar os testes de carga e testes funcionais automatizados (E2E) no CI/CD.

## **3. Processo de Mudança de Schema**

Toda alteração estrutural deve ser registrada como uma Tarefa Técnica, vinculada a uma User Story e ao respectivo requisito no Jira.

O processo segue as etapas abaixo.

### **3.1. Branch e rastreabilidade**

1. Criar uma branch a partir da `main`, seguindo a nomenclatura `SCRUM-{ID}`.
2. Vincular a branch e o Pull Request ao requisito e à tarefa técnica no Jira.
3. Descrever no PR o objetivo da mudança, os impactos esperados e os riscos identificados.

### **3.2. Alteração do schema e geração da migration**

O desenvolvedor deve:

1. Alterar o `schema.prisma` conforme a necessidade da tarefa.
2. Gerar a migration utilizando o ambiente local de desenvolvimento:
`npx prisma migrate dev --name <descricao>`
3. Inspecionar o SQL produzido pelo Prisma.
4. Executar e validar a migration no ambiente local.
5. Incluir os testes e scripts SQL necessários.

Cada mudança de schema deve criar uma migration nova e autocontida. Não se deve renomear, apagar, reordenar ou editar uma migration já compartilhada; o CI deve detectar alterações em migrations existentes. Em revisão, deve ser possível identificar a partir do diff qual migration será aplicada e qual estado do schema ela produz. Para reconstruir um banco vazio, usar `npx prisma migrate deploy`; para conferir se o schema declarado e o histórico versionado divergem, executar a validação de diff configurada no CI.

Quando recursos específicos do PostgreSQL não puderem ser representados diretamente pelo Prisma, será permitido complementar ou ajustar o SQL da migration.

Toda alteração manual deve ser intencional, documentada, testada e revisada. Não é permitido modificar silenciosamente migrations já aplicadas em ambientes compartilhados. Nesses casos, a correção deve ser realizada por meio de uma nova migration.

Após o merge e a aplicação em ambientes compartilhados, as migrations tornam-se imutáveis.

### **3.3. Pipeline de CI**

A abertura ou atualização do Pull Request deve acionar a pipeline de Integração Contínua.

A pipeline deve:

1. Validar o schema e a configuração do Prisma.
2. Disponibilizar um banco efêmero compatível com a versão de PostgreSQL e PostGIS adotada pelo projeto.
3. Aplicar todas as migrations desde o estado inicial previsto.
4. Validar a criação dos objetos SQL personalizados necessários.
5. Executar os testes de integração da aplicação.
6. Testar as regras críticas relacionadas à trigger `trg_avaliar_alertas_lote`.
7. Executar testes das operações geoespaciais relevantes.
8. Detectar divergências de schema quando houver um mecanismo de validação aplicável.
9. Publicar os resultados para consulta durante o Code Review.

A pipeline deve bloquear o merge caso uma verificação obrigatória falhe.

A validação de uma migration não se limita à execução bem-sucedida do SQL: os testes também devem confirmar o comportamento esperado da aplicação e a integridade dos dados.

**Como a CI cumpre hoje** (jobs `migrations` e `testes`, ver Integração contínua (wiki)):

| Item | Como | Situação |
|---|---|---|
| 1. Validar schema | `prisma validate` | coberto |
| 2. Banco efêmero compatível | service `postgis/postgis:16-3.4`, a mesma imagem do compose | coberto |
| 3. Migrations desde o início | `prisma migrate deploy` em banco vazio | coberto |
| 4. Objetos SQL personalizados | o `migrate deploy` executa o SQL; os testes funcionais exercitam as triggers | coberto |
| 5. Testes de integração | `npm run test:functional` contra o banco real (em série) | coberto |
| 6. Trigger `trg_avaliar_alertas_lote` | exercitada indiretamente: specs que gravam medidas e conferem os alarmes (`fluxo-telemetria`, `alarmes`, `relatorio-incidentes`) | **parcial**: falta uma spec dedicada às regras da trigger (tarefa) |
| 7. Operações geoespaciais | `relatorio-incidentes.spec.ts` (filtro por raio com PostGIS) | **parcial**: demais consultas espaciais sem teste (tarefa) |
| 8. Divergência de schema | `prisma migrate diff --exit-code` | coberto |
| 9. Resultados no Code Review | checks no PR; o `CI ok` lista o job que falhou e o tempo de cada um | coberto |
| Imutabilidade de migration mergeada | `git diff --diff-filter=MDR` em `prisma/migrations` (só PR); liberado só com o label `incidente-de-planejamento` | coberto |
| Seed | `npm run db:seed` | coberto |
| Restauração (6.2) | suíte noturna | coberto com dados de seed |

O bloqueio do merge depende de o check `CI ok` estar exigido na ruleset da `main`.

### **3.4. Code Review**

O revisor deve verificar:

* A correção funcional e estrutural da mudança.
* O SQL gerado e eventuais complementos manuais.
* A possibilidade de locks prolongados e indisponibilidade.
* O impacto sobre índices, constraints e integridade referencial.
* Os riscos de perda ou transformação incorreta de dados.
* O impacto em tabelas grandes e em operações com alto volume.
* A compatibilidade com a aplicação em execução.
* A presença e o comportamento dos objetos SQL necessários.
* A adequação dos testes e dos procedimentos de recuperação.

Mudanças potencialmente destrutivas ou de alto impacto devem ter seus riscos explicitamente registrados no PR e receber aprovação técnica antes de serem implantadas.

### **3.5. Staging e homologação**

**Situação atual:** não existe ambiente de staging com banco próprio. O que existe é um **preview** (`publicar-staging.yaml`): o revisor coloca o label `staging` no PR, e o código integrado com a main vai para a branch `staging`, sem deploy e sem banco próprio. Não bloqueia o merge.

**Previsto (roadmap):** a **pré-release**, uma VM clone da produção, com banco e credenciais independentes, que só recebe um commit aprovado na suíte noturna. Ela é o ensaio das migrations: `prisma migrate deploy` roda primeiro na pré-release e só depois na produção, com o mesmo pacote. Ver Roadmap DevOps (wiki), Fase 4.

A validação na pré-release deve incluir:

* Aplicação das migrations.
* Testes integrados da funcionalidade.
* Verificação das regras de negócio afetadas.
* Validação das operações SQL críticas.
* Avaliação de erros e regressões.

Enquanto a VM não existe, a suíte noturna cobre parte disso: migrations do zero, seed e ponta a ponta com banco real.

### **3.6. Merge e release**

Após o cumprimento da Definition of Done e o aceite exigido:

1. A branch é mergeada na `main`.
2. A branch de trabalho é removida conforme o fluxo do repositório.
3. A migration é mantida no histórico versionado.
4. A release é gerada a partir de uma versão identificável da `main`, preferencialmente por tag.
5. O pipeline de Produção executa as migrations pendentes utilizando:
`npx prisma migrate deploy`

A execução deve ocorrer de forma controlada, com proteção contra execuções concorrentes de migrations no mesmo ambiente.

Quando a pré-release existir, esse mesmo `migrate deploy` terá rodado antes nela (ensaio), com o mesmo pacote. **O rollback do código não desfaz o banco:** por isso mudanças incompatíveis seguem expand/contract (seção 4), para que a versão anterior da aplicação continue funcionando com o schema novo.

As credenciais utilizadas para a implantação devem ter apenas as permissões necessárias para a operação.

### **3.7. Validação pós-deploy**

Após a implantação em Produção, devem ser verificados:

* [ ] O estado da aplicação e dos serviços dependentes.
* [ ] Os Health Checks.
* [ ] Os logs de erro da aplicação e do banco.
* [ ] O comportamento das funcionalidades afetadas.
* [ ] A integridade dos dados envolvidos.
* [ ] Métricas de latência, erros e consumo de recursos, quando disponíveis.

Se houver falha, o time deve seguir o procedimento de recuperação definido para a mudança, sem presumir que o rollback da aplicação desfará as alterações já aplicadas ao banco.

### 3.8. Janelas de Modificação de Banco na Sprint (Cronograma)

Alterações no banco de dados apresentam alto risco de quebra de integração. Portanto, as mudanças estruturais devem respeitar o ciclo da Sprint:

* **Início da Sprint:** A modelagem de novas tabelas, alteração profunda de relacionamentos, remoção de colunas e criação de índices (como o GiST do PostGIS) devem ser definidas e executadas exclusivamente nos primeiros dias da Sprint. Após essa fase, o core estrutural do banco é congelado para a Sprint atual.
* **Meio da Sprint:** Apenas pequenas alterações corretivas ou não-destrutivas (ex: adição de um campo não obrigatório, ajustes em views/triggers específicas isoladas).
* **Fim da Sprint:** É **terminantemente proibido** realizar ou aprovar PRs com alterações no `schema.prisma` ou migrations estruturais nos últimos dias da Sprint. Esse período é exclusivo para estabilização, testes E2E e validação de carga.

**Exceções explícitas** (a janela é um acordo do time: a CI não trava PR por data):

* **Hotfix de produção:** segue o fluxo de hotfix, com o registro de aprovação no Confluence (7.2).
* **Fase Contract planejada:** a remoção de um expand/contract já combinada na Sprint Planning.
* **Incidente de planejamento (Big Migration fora da janela):** a Big Migration que entra depois da semana 1, inclusive a que consolida migrations antigas numa só, é tratada como incidente. O PR leva o label `incidente-de-planejamento` e a justificativa, tem o registro no Confluence com 2 assinaturas (7.2) e gera o Relatório de Incidente de Banco (7.2), dizendo por que a mudança não coube na janela. Consolidar migrations só é permitido enquanto nenhuma delas rodou na pré-release ou na produção; depois disso, nunca. O label libera só o check de imutabilidade da CI: migrations do zero, diff do schema e testes continuam obrigatórios, e o PR mostra que o schema produzido é idêntico ao anterior. Depois do merge, cada dev recria o banco local (`npx prisma migrate reset` e `npm run db:seed`), porque o histórico local de migrations deixa de bater.

Fora disso, PR de schema no fim da Sprint precisa da justificativa no PR e da assinatura de 2 desenvolvedores, a mesma regra de mudança crítica (7.2).

## **4. Evolução Segura do Schema: Expand/Contract**

Mudanças incompatíveis devem ser realizadas de forma progressiva, evitando alterações destrutivas em uma única implantação.

O padrão Expand/Contract é dividido em três fases.

### **4.1. Expand**

O novo formato é criado ao lado do antigo.

A aplicação deve ser adaptada para suportar a transição sem interromper o funcionamento das versões em execução.

Quando necessário, a aplicação poderá escrever nos formatos antigo e novo durante o período de transição.

Antes de prosseguir, deve ser verificado que a nova estrutura é compatível com os consumidores existentes.

### **4.2. Migrate**

Os dados são migrados para o novo formato, por meio de scripts ou migrations apropriadas.

A aplicação passa a ler o novo formato somente após a validação da migração e da compatibilidade necessária.

A tarefa deve incluir verificações de consistência, contagem de registros ou outras evidências adequadas ao tipo de dado.

Em operações de grande volume, deve ser avaliado o uso de processamento em lotes para reduzir locks, transações longas e impacto sobre a aplicação.

### **4.3. Contract**

A estrutura antiga é removida somente após comprovação de que deixou de ser utilizada.

Antes da remoção, devem ser verificados:

* A compatibilidade de todas as versões da aplicação em execução.
* A ausência de dependências em jobs, relatórios, integrações e consumidores externos.
* A conclusão e a validação da migração de dados.
* A disponibilidade de um procedimento de recuperação adequado ao risco.

A fase Contract deve possuir uma tarefa técnica própria no Sprint Backlog, identificada como dívida técnica ou manutenção planejada.

A remoção deve ocorrer em uma release posterior à implantação da fase Expand. O intervalo mínimo deve considerar o ciclo de release, os consumidores ativos e as evidências de que o formato antigo não é mais utilizado. A passagem de uma única release, isoladamente, não constitui evidência suficiente.

## **5. Segurança, Ambientes e Dados Sensíveis**

### **5.1. Isolamento dos ambientes**

Desenvolvimento, Staging e Produção devem possuir bancos, credenciais e configurações independentes.

As credenciais devem ser armazenadas em mecanismos apropriados de gestão de segredos, nunca em arquivos versionados ou diretamente no código.

O princípio do menor privilégio deve ser aplicado a todos os acessos.

Sempre que possível, devem existir identidades distintas para:

* A execução normal da aplicação.
* A aplicação de migrations.
* As atividades administrativas e de manutenção.

O acesso administrativo deve ser restrito e auditável.

### **5.2. Proteção de dados pessoais e sensíveis**

Dados reais de Produção não devem ser copiados diretamente para ambientes locais ou de desenvolvimento.

Quando for necessário reproduzir um problema, os dados devem ser anonimizados ou mascarados antes de sua disponibilização.

O processo de anonimização deve impedir a exposição indevida de informações pessoais, incluindo identificadores indiretos que possam permitir a reidentificação.

O compartilhamento de dados deve respeitar as políticas internas de segurança e os requisitos legais aplicáveis, incluindo a LGPD.

### **5.3. Controle de acesso e auditoria**

As permissões de acesso devem ser revisadas periodicamente e revogadas quando deixarem de ser necessárias.

As operações críticas, alterações estruturais e atividades administrativas devem possuir rastreabilidade compatível com o risco.

As credenciais e os logs não devem expor senhas, tokens ou outros segredos.

## **6. Backups, Restauração e Recuperação**

A continuidade do serviço depende da existência de backups confiáveis e de procedimentos de recuperação testados.

### **6.1. Política de backup**

O ambiente de Produção deve possuir backups automatizados e monitorados.

A estratégia deve definir:

* Frequência de execução.
* Período de retenção.
* Proteção e criptografia dos arquivos.
* Local de armazenamento separado do ambiente principal.
* Monitoramento das falhas de backup.
* Procedimento de restauração.
* Requisitos de recuperação pontual, quando aplicáveis.

A frequência, a retenção e o mecanismo de backup devem ser definidos considerando o volume de dados e as necessidades do negócio.

### **6.2. Testes de restauração**

Um backup só será considerado confiável quando houver evidência de que pode ser restaurado.

Os testes devem ocorrer periodicamente em um ambiente isolado e verificar:

* A conclusão da restauração.
* A integridade dos dados.
* A presença da extensão PostGIS e dos objetos necessários.
* A existência e o funcionamento das estruturas críticas.
* A consistência da aplicação após a recuperação.
* O tempo necessário para concluir o procedimento.

Os resultados devem ser registrados para auditoria e melhoria contínua.

**Como está hoje:** a suíte noturna faz o teste de restauração com dados de seed e sintéticos, nunca dados reais (5.2): `pg_dump` do banco semeado, `pg_restore` num banco efêmero e comparação de extensão PostGIS, triggers, constraints e contagem de linhas por tabela, com o tempo medido no resumo do run. Esse tempo é referência para o volume do seed, não o RTO de produção. O teste com o backup real depende da VM e de quem executa o backup (1.4: a infraestrutura do cliente).

### **6.3. RPO e RTO**

O projeto deve definir, com participação das áreas responsáveis pelo negócio:

* **RPO (Recovery Point Objective):** perda máxima de dados aceitável, expressa como intervalo de tempo.
* **RTO (Recovery Time Objective):** tempo máximo desejado para restabelecer o serviço.

A estratégia de backup, replicação e recuperação deve ser compatível com esses objetivos.

**Decisão pendente:** RPO, RTO, frequência e retenção de backup, e quem executa o backup em produção, ainda não foram definidos com o cliente. Até lá, nenhum valor é prometido aqui (ver Roadmap DevOps (wiki), Decisões pendentes).

### **6.4. Falha em migrations e recuperação de Produção**

Em caso de falha durante uma migration:

1. Interromper a progressão do deploy conforme o procedimento operacional.
2. Registrar os logs e identificar o estado real do banco.
3. Consultar o estado das migrations no Prisma e verificar quais operações foram efetivamente executadas.
4. Avaliar se a migration pode ser corrigida de forma segura ou se exige intervenção especializada.
5. Preservar os dados e evitar alterações manuais sem plano de recuperação.
6. Aplicar a correção aprovada e validar a integridade do banco.
7. Executar os testes de saúde e confirmar o funcionamento da aplicação.

A tabela de histórico de migrations do Prisma deve ser consultada durante o diagnóstico, mas não deve ser modificada manualmente sem procedimento técnico validado.

Quando a restauração de backup for necessária, devem ser considerados o tempo de recuperação, a possível perda de dados posteriores ao backup e a compatibilidade da versão da aplicação com o banco restaurado.

Não deve ser executado um rollback destrutivo automático como resposta genérica a qualquer falha.

## **7. Monitoramento e Operação**

O banco de dados deve ser monitorado de acordo com sua criticidade.

Quando houver suporte técnico e ferramentas disponíveis, devem ser acompanhados:

* Disponibilidade e conexões.
* Latência e consultas lentas.
* Locks prolongados e deadlocks.
* Consumo de CPU, memória e armazenamento.
* Crescimento das tabelas e dos índices.
* Falhas de migrations e backups.
* Erros relacionados às triggers e operações geoespaciais.

Os limites de alerta devem ser definidos de acordo com a capacidade do ambiente e os requisitos da aplicação.

Incidentes devem gerar registros com causa identificada quando possível, impacto observado, ações executadas e medidas preventivas.

### **7.1. Testes de carga e desempenho do banco**

Mudanças que possam alterar o volume de escrita ou leitura, o uso de índices, triggers, consultas, locks ou o tempo de processamento devem considerar testes de carga antes da aprovação. Os testes devem usar um banco isolado identificado para carga (por exemplo, `kernelpanic_carga`), nunca Desenvolvimento compartilhado, Staging ou Produção.

O teste deve descrever e registrar:

* A versão do PostgreSQL/PostGIS, configuração relevante, recursos da máquina e se aplicação, gerador e banco compartilham o mesmo host.
* O volume e o formato dos dados, a taxa oferecida, a duração, o aquecimento e a ferramenta ou script utilizado.
* Latência p50/p95/p99, taxa efetiva, erros, filas/atrasos e conferência de perda ou duplicidade de dados.
* O resultado antes/depois quando a mudança pretende melhorar desempenho, além de limitações que impeçam extrapolar a medição para Produção.

**Alvos de capacidade:** não há requisito do cliente para número de usuários ou de requisições por segundo; esses alvos estão em aberto (pontos P18/P19 da equipe). O critério de referência documentado hoje é o do plano de QA para a cadeia de ingestão: **p95 ponta a ponta abaixo de 2 segundos, sem perda de pacotes**. Há uma proposta da equipe de flexibilizar para 10 s, também em aberto. O procedimento, os scripts, os resultados e as limitações estão em [Teste de carga da ingestão](teste-de-carga-ingestao.md); esse relatório deve ser atualizado quando uma nova medição substituir ou complementar a linha de base. Medições locais não garantem capacidade em produção. A suíte noturna roda uma carga leve toda noite, com os limites em variáveis do repositório, para pegar regressão; a medição oficial de capacidade depende da pré-release.

Em alterações específicas de banco, como criação de índice ou modificação de consulta, também devem ser comparados planos e tempos de consultas representativas e custo de escrita, usando volume de dados que represente o cenário avaliado. A decisão de adotar ou não a mudança e os riscos operacionais devem constar na tarefa ou no Pull Request.

### 7.2. Rastreabilidade, Aprovações e Relatórios de Incidente

Para garantir governança total sobre o que é executado no banco, cada mudança estrutural ou incidente de performance exige uma trilha de auditoria formal:

* **Aprovação de Mudanças Críticas:** Alterações estruturais ou alterações em regras de negócio rodando no banco (como a `trg_avaliar_alertas_lote`) devem estar documentadas no **Confluence** e assinadas (validadas) por **pelo menos 2 desenvolvedores (Double Check)**. Esse registro documentará "quem assinou e aprovou" e "o script exato que rodou". O link desse registro vai no corpo do PR que altera `prisma/migrations/**` (bloco "Banco de dados" do template de PR); a trava automática que exige o link está no roadmap.
* **Post-mortem de Incidentes:** Em caso de falhas em migrations, quedas de desempenho abaixo dos alvos de carga (7.1), locks ou regressões, é obrigatória a geração de um "Relatório de Incidente de Banco". O documento deve rastrear a origem do problema, mapear a alteração causadora, detalhar a correção aplicada e ser armazenado na base de conhecimento do projeto.

## **8. Definition of Ready (DoR) para Tarefas de Banco de Dados**

Antes de iniciar uma tarefa que altere o banco de dados, devem estar definidos:

* O requisito e a tarefa técnica estão vinculados no Jira.
* O objetivo e o resultado esperado da mudança estão descritos.
* As entidades, tabelas e regras de negócio afetadas foram identificadas.
* Os impactos sobre triggers, funções, índices, constraints e PostGIS foram avaliados, quando aplicáveis.
* Os riscos de compatibilidade, locks e alterações de dados foram considerados.
* A necessidade de Expand/Contract foi avaliada.
* Os critérios de teste e aceite estão definidos.
* A necessidade de teste de carga ou medição de consulta foi avaliada; quando aplicável, cenário, critério e ambiente isolado estão definidos.
* A estratégia de recuperação está identificada para mudanças de alto risco.

## **9. Definition of Done (DoD) para Tarefas de Banco de Dados**

Para que uma tarefa seja aprovada no Code Review e possa ser mergeada, devem ser atendidos os critérios aplicáveis abaixo.

### **9.1. Rastreabilidade e revisão**

* [ ] A branch e o Pull Request seguem a nomenclatura `SCRUM-{ID}` e estão vinculados ao Jira.
* [ ] O `schema.prisma` e as migrations foram versionados.
* [ ] O SQL gerado pelo Prisma foi revisado.
* [ ] Alterações manuais em SQL estão justificadas, documentadas e testadas.
* [ ] Os riscos de locks, perda de dados, índices e integridade foram avaliados.
* [ ] A versão PostgreSQL/PostGIS e do Prisma usada na validação está identificada.
* [ ] Quando a mudança puder afetar desempenho, a evidência de teste de carga ou medição representativa foi registrada, incluindo limites da medição.

### **9.2. Testes e compatibilidade**

* [ ] A validação do Prisma foi concluída com sucesso.
* [ ] As migrations foram aplicadas em banco efêmero compatível com o ambiente de destino.
* [ ] Os testes de integração da pipeline estão passando.
* [ ] Os testes das regras de negócio e das triggers afetadas estão passando.
* [ ] As operações PostGIS afetadas foram testadas.
* [ ] A compatibilidade entre a aplicação e o schema foi verificada.
* [ ] O merge está bloqueado caso alguma verificação obrigatória falhe.

### **9.3. Segurança e recuperação**

* [ ] Nenhum segredo foi incluído no código ou no repositório.
* [ ] O tratamento dos dados respeita a política de segurança.
* [ ] Mudanças críticas possuem procedimento de recuperação adequado.
* [ ] Mudanças que exigem Expand/Contract possuem as tarefas correspondentes.
* [ ] A fase Contract possui evidências de que o formato antigo deixou de ser utilizado.

### **9.4. Implantação e operação**

* [ ] O plano de implantação e as verificações pós-deploy estão definidos para mudanças relevantes.
* [ ] Os procedimentos de monitoramento e validação foram considerados.
* [ ] A documentação operacional foi atualizada quando necessário.
