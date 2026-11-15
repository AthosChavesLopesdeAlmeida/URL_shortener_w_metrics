# Guia de estudo: fila e worker

Este guia explica o código da Fase 4 (cliques assíncronos) e o que levar dele para outros contextos. Como no guia de cache e rate limiter, a ideia é ler o código **com um mapa na mão**, e não decorá-lo.

**Como usar:** abra os arquivos reais ao lado deste guia, siga a ordem de leitura e, no fim de cada parte, tente responder às perguntas de verificação sem olhar o código.

---

## Parte 0. Conceitos que valem para os dois lados

| Conceito | O que é | Onde aparece |
|---|---|---|
| **Fila** | Uma lista de tarefas pendentes guardada fora do processo que as cria | BullMQ, sobre o Redis |
| **Produtor** | Quem coloca tarefas na fila | `ClickPublisherService`, na API |
| **Consumidor (worker)** | Quem retira e executa as tarefas | `apps/worker` |
| **Job** | Uma tarefa na fila: um nome, um payload (JSON) e opções | Um evento de clique |
| **Desacoplamento** | Produtor e consumidor não se conhecem nem precisam estar de pé ao mesmo tempo | O redirect funciona com o worker desligado |
| **Entrega "pelo menos uma vez"** | Um job é entregue uma ou mais vezes, nunca zero (se o sistema está saudável) | Reentrega após queda do worker |
| **Idempotência** | Executar a mesma operação duas vezes tem o mesmo efeito que executar uma | `event_id` + `ON CONFLICT DO NOTHING` |
| **Backoff exponencial** | Esperar cada vez mais entre as tentativas (1 s, 2 s, 4 s...) | Opções padrão da fila |
| **Retenção** | Por quanto tempo jobs concluídos e falhos ficam guardados | `removeOnComplete` e `removeOnFail` |
| **Lote (batch)** | Agrupar várias escritas em uma só | `BatchWriter` |

**A ideia central da fase:** separar o que o usuário precisa *agora* (o 302) do que o sistema pode fazer *depois* (registrar, enriquecer e gravar o clique). A fronteira entre os dois é a fila.

Duas decisões do projeto explicam várias linhas:

- **Redis com `noeviction` (decisão 001):** o Redis nunca apaga chaves por falta de memória. Se a fila encher, as escritas passam a falhar, incluindo sessões, cache e rate limit. Por isso a **retenção dos jobs é obrigatória**.
- **A fila só recebe cliques.** Criar link e redirecionar continuam síncronos. Só o registro do clique é assíncrono.

---

## Parte 1. Como ler o lado da API (produtor)

### 1.1 O que ele resolve

Registrar cada clique sem somar nada ao tempo do redirect. A API só monta um evento pequeno e o entrega à fila, sem esperar.

### 1.2 Ordem de leitura

```
1. queue.constants.ts           Os nomes (tokens) da fila e da conexão
2. queue.module.ts              Como a fila e a conexão são criadas
3. click-publisher.service.ts   Como o evento é montado e publicado
4. redirect.service.ts          De onde vem o linkId
5. redirect.controller.ts       Onde o publish é chamado
6. (contrato) click-event.ts    O formato do evento, em packages/shared
```

### 1.3 Arquivo por arquivo

#### `click-event.ts` (em `packages/shared`): o contrato

É o formato do job, compartilhado entre API e worker. Leia os campos pensando em quem os cria e quem os usa:

- `eventId`: UUID criado **pela API**. É a chave de idempotência.
- `clickedAt`: horário criado **pela API**. Se o worker o criasse, uma reentrega teria horário diferente e a idempotência falharia, porque a constraint única é o par `(event_id, clicked_at)`.
- `linkId`: de qual link veio o clique.
- `ip`, `userAgent`, `referrer`: dados crus. O worker os transforma depois. O IP serve só para descobrir o país e **nunca é gravado**.
- Todos os campos opcionais são `.nullable()` e não `.optional()`, porque `undefined` some na serialização JSON e o formato ficaria imprevisível.

#### `queue.constants.ts`

Só duas strings (`QUEUE_REDIS` e `CLICK_QUEUE`). Ele existe separado por um motivo prático: o `queue.module.ts` importava o publisher e o publisher importava o token do módulo, formando um **ciclo de imports** e deixando o provider `undefined`. Regra geral no Nest: **tokens e constantes ficam em arquivos próprios**, para a dependência entre arquivos ter mão única.

#### `queue.module.ts`

Dois providers e um hook de encerramento.

**`QUEUE_REDIS`, a conexão própria da fila.** A opção que importa é `enableOfflineQueue: false`. Por padrão, se o Redis cai, o ioredis guarda os comandos e espera a reconexão, então `queue.add` ficaria pendurado. Com a opção desligada, ele **falha na hora**, e o publisher captura o erro e segue. A conexão é separada porque o cache e o rate limiter usam outras opções (`commandTimeout`, `maxRetriesPerRequest: 1`) que conflitariam.

**`CLICK_QUEUE`, a `Queue` do BullMQ,** com opções padrão para todos os jobs:

| Opção | Valor | Por quê |
|---|---|---|
| `attempts` | 5 | Cobre falhas temporárias do banco no worker |
| `backoff` | exponencial, 1 s | Espera crescente entre tentativas, para não martelar um banco que já está mal |
| `removeOnComplete` | 1 hora ou 1000 jobs | Sem isso, jobs concluídos ficam para sempre e enchem o Redis |
| `removeOnFail` | 7 dias ou 5000 jobs | Falhos ficam mais tempo para você inspecionar o que deu errado |

**Handlers de `error`:** um `EventEmitter` sem handler derruba o processo quando emite `error`. Com eles, a queda do Redis vira um aviso no log.

**`onApplicationShutdown`:** fecha a fila e a conexão. Se o Redis estiver fora do ar, o `quit()` falharia e travaria o `app.close()`, então o `catch` força o `disconnect()`.

#### `click-publisher.service.ts`

Uma responsabilidade: montar o evento e publicá-lo **sem nunca lançar erro**.

1. Gera `eventId` e `clickedAt`.
2. Trunca `userAgent` e `referrer` ao limite do schema (o schema só rejeita, não corta; sem o corte, um cabeçalho longo geraria um evento que o worker recusaria para sempre).
3. Chama `queue.add('click', event, { jobId: event.eventId })`.
4. Envolve tudo em `try/catch`, registra um aviso e retorna.

O `jobId` evita duplicatas **enquanto o job existe** no Redis. Depois de removido pela retenção, o mesmo id poderia ser aceito de novo. Por isso ele é uma otimização, e a **garantia final é a constraint do banco**.

#### `redirect.service.ts` e `redirect.controller.ts`

- O `resolve` passou a devolver o `linkId`, porque a tabela `click_events` exige `link_id`. O cache também guarda o `linkId`, senão os acessos HIT não teriam como publicar o evento.
- No controller, a chamada é `void this.clicks.publish(...)`: **sem `await`**. O `void` deixa explícito que a Promise é ignorada de propósito, e isso é seguro porque o `publish` nunca rejeita.
- A publicação vem **depois** do `resolve`. Como o `resolve` lança exceção em 404 e 410, o `publish` só roda em respostas 302, sem precisar de `if`.

### 1.4 Rastreando uma requisição

`GET /AbC1234`:

```
Rate limit → resolve (cache ou Postgres) → linkId conhecido
  → void publish(...)            não espera
  → return 302                   o usuário já tem a resposta

em segundo plano:
  publish → monta o evento → queue.add → Redis grava o job
  (se o Redis falhar: aviso no log, o clique se perde, o redirect não é afetado)
```

### 1.5 Perguntas de verificação

1. Por que `clickedAt` é gerado na API e não no worker?
2. O que acontece com `queue.add` se o Redis cair e `enableOfflineQueue` estiver ligado?
3. Por que a fila tem conexão Redis própria?
4. Por que `removeOnFail` guarda mais que `removeOnComplete`?
5. Por que o `jobId` não basta para garantir que o clique não seja duplicado?
6. Por que o `publish` captura todos os erros em vez de deixá-los subir?

---

## Parte 2. Como ler o worker (consumidor)

### 2.1 O que ele resolve

Retirar eventos da fila, enriquecê-los e gravá-los em lote no Postgres, de forma que reentregas não dupliquem linhas e falhas temporárias sejam repetidas.

### 2.2 Ordem de leitura

```
1. config/env.ts                       Quais variáveis o worker exige?
2. enrichment/ (geoip, device, referrer, enrich)   Como o evento cru vira dado útil?
3. db-errors.ts                        Como reconhecer um erro específico do Postgres?
4. batch-writer.ts                     Como acumular e gravar em lote?
5. processors/click-events.processor.ts   O que acontece com cada job?
6. main.ts                             Como tudo é montado e encerrado?
```

### 2.3 Arquivo por arquivo

#### `config/env.ts`

Mesmo padrão da API: schema zod, `.env` da raiz e falha imediata com mensagem clara. A regra que merece atenção é o `refine`: `WORKER_CONCURRENCY >= BATCH_SIZE`. O motivo vem do `batch-writer`: cada job só termina quando o lote dele é gravado, então, com concorrência menor que o tamanho do lote, o buffer nunca enche e só o timer descarrega.

#### `enrichment/`

Quatro arquivos pequenos e **puros** (o `geoip` só depende de um arquivo aberto uma vez):

- `geoip.ts`: abre o `.mmdb` uma vez na inicialização. Sem o arquivo, o worker sobe e grava `null`.
- `device.ts`: reduz o user-agent a cinco categorias fixas (`desktop`, `mobile`, `tablet`, `bot`, `other`). Bots são **marcados, não descartados**: filtrar fica para a consulta de métricas.
- `referrer.ts`: reduz a URL a um domínio, sem `www.`, sem caminho nem parâmetros. Acesso direto vira `null`.
- `enrich.ts`: junta os três e devolve exatamente as colunas de `click_events`.

Ser puro importa porque deixa as funções testáveis com um objeto falso no lugar do GeoIP.

#### `db-errors.ts`

O Drizzle embrulha o erro do driver em `cause`, então o código do Postgres pode estar em `err.cause.code` ou `err.code`. A função lê os dois. O código que interessa é `23503` (violação de chave estrangeira): acontece quando o link foi **excluído entre o clique e o processamento**.

#### `batch-writer.ts`

É a peça mais interessante do worker. Ele mantém um buffer em memória e descarrega por **tamanho ou por tempo**, o que vier primeiro.

```
add(row)
  ├─ coloca a linha no buffer, junto com um resolve/reject
  ├─ buffer cheio?   → flush agora
  └─ senão, sem timer ativo?  → agenda flush em BATCH_FLUSH_MS
  └─ devolve uma Promise que só resolve quando o lote for gravado
```

O ponto-chave: `add` devolve uma **Promise ligada ao lote**. O processador dá `await writer.add(...)`, então o BullMQ só considera o job concluído **depois que a linha está no banco**. É isso que preserva a entrega "pelo menos uma vez": se o processo morrer com linhas no buffer, os jobs ainda não foram confirmados e serão reentregues.

O `flush` faz:

1. Cancela o timer.
2. **Troca o buffer por um vazio antes de qualquer `await`.** Isso impede que dois flushes simultâneos gravem as mesmas linhas.
3. Insere o lote inteiro em um comando, com `ON CONFLICT DO NOTHING`.
4. Sucesso: resolve a Promise de todos. Falha: rejeita todos, e o BullMQ agenda o retry de cada um.

**O tratamento do erro `23503`.** Um único evento de um link excluído faria o lote inteiro falhar, e os 99 eventos válidos entrariam em retry por causa de um. Por isso, nesse caso específico, o lote é regravado **linha por linha**: as válidas passam, e a do link excluído é rejeitada com `UnrecoverableError` (sem retry, porque nunca vai funcionar).

#### `processors/click-events.processor.ts`

A função que o BullMQ chama para cada job. Quatro passos:

1. **Valida** o payload com o schema zod. Inválido: `UnrecoverableError`, que falha o job **sem retry**.
2. **Enriquece** (país, dispositivo, referrer).
3. **Monta a linha** com `eventId`, `linkId` e `clickedAt` do evento. O IP não entra.
4. **Entrega ao writer** e espera.

Classificar o erro é o que torna o retry útil: falha **temporária** (banco fora do ar) deve ser repetida; falha **permanente** (payload inválido, link excluído) não deve, porque gastaria as cinco tentativas à toa.

#### `main.ts`

Monta as peças na ordem: ambiente, banco, GeoIP, conexão Redis, writer, worker. Pontos importantes:

- **`maxRetriesPerRequest: null`** na conexão do worker: exigência do BullMQ, que usa comandos bloqueantes de longa duração.
- **`concurrency`:** quantos jobs rodam ao mesmo tempo. É o que permite o lote encher.
- **Encerramento limpo (SIGINT e SIGTERM):** `worker.close()` (para de pegar jobs e espera os ativos), `writer.flush()` (descarrega o que sobrou), depois fecha o pool do Postgres e o Redis. Sem isso, cada Ctrl+C ou deploy perde o que estava no buffer.

### 2.4 Rastreando um clique, do começo ao fim

```
API:     GET /AbC1234 → 302 → publish → job no Redis
Worker:  pega o job
         → valida (zod)
         → enriquece: país (GeoIP), dispositivo, referrer
         → writer.add(): entra no buffer
         → buffer cheio ou timer de 1 s → INSERT em lote ... ON CONFLICT DO NOTHING
         → Promise resolve → job concluído → BullMQ o remove após a retenção

Se o worker morrer antes do INSERT:
         o job não foi confirmado → será reentregue → grava uma vez
Se morrer depois do INSERT e antes de confirmar:
         será reentregue → ON CONFLICT DO NOTHING ignora → continua sendo uma linha
```

### 2.5 Perguntas de verificação

1. Por que a Promise do `writer.add` só resolve depois de gravar o lote?
2. Por que o `flush` troca o buffer antes de qualquer `await`?
3. Qual a diferença entre um erro que merece retry e um `UnrecoverableError`? Dê um exemplo de cada.
4. O que acontece com um lote de 100 eventos se um deles aponta para um link excluído?
5. Por que `WORKER_CONCURRENCY` precisa ser maior ou igual a `BATCH_SIZE`?
6. Por que o worker precisa de `maxRetriesPerRequest: null`?
7. O que se perde se o processo for encerrado com `kill -9`, e por que não há duplicatas na reentrega?

---

## Parte 3. O básico para implementar fila e worker em um contexto geral

Os exemplos usam BullMQ e não dependem de Nest.

### 3.1 Quando usar uma fila

Use quando uma parte do trabalho:

- **não precisa terminar antes de responder** ao usuário (enviar email, gerar relatório, registrar métrica);
- é **lenta ou instável** (chama serviço externo, processa arquivo);
- precisa de **retry** automático;
- pode ter **picos** que você quer suavizar (a fila absorve, o worker consome no seu ritmo).

Não use quando o usuário precisa do resultado na mesma resposta (por exemplo, criar o link curto), nem quando uma função assíncrona simples resolve e perder a tarefa não importa.

### 3.2 O mínimo que funciona

**Produtor:**

```ts
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const connection = new Redis(process.env.REDIS_URL!, { enableOfflineQueue: false });

export const emailQueue = new Queue('emails', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
  },
});

// em algum handler
await emailQueue.add('welcome', { userId, email }, { jobId: `welcome:${userId}` });
```

**Consumidor (processo separado):**

```ts
import { Worker, UnrecoverableError } from 'bullmq';
import { Redis } from 'ioredis';

const connection = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

const worker = new Worker(
  'emails',
  async (job) => {
    if (!isValid(job.data)) throw new UnrecoverableError('payload inválido'); // sem retry
    await sendEmail(job.data); // qualquer outro erro: retry com backoff
  },
  { connection, concurrency: 10 },
);

worker.on('failed', (job, err) => console.error('falhou', job?.id, err.message));
worker.on('error', (err) => console.error('erro do worker', err.message));

process.on('SIGTERM', async () => {
  await worker.close();
  await connection.quit();
});
```

### 3.3 Checklist antes de colocar uma fila em produção

1. **Retenção configurada** (completos e falhos). Sem isso, a memória enche.
2. **Todo job é idempotente?** Executar duas vezes não pode causar dano.
3. **Quais erros são temporários e quais são permanentes?** Os permanentes não devem gastar tentativas.
4. **O que acontece se o Redis cair?** O produtor deve falhar rápido, e você precisa decidir se perder a tarefa é aceitável.
5. **O que acontece se o worker cair?** Os jobs devem esperar na fila.
6. **O payload é pequeno?** Envie ids e dados mínimos, não objetos enormes. Quem processa busca o resto.
7. **Existe encerramento limpo** no worker?
8. **Alguém olha os jobs falhos?** Uma fila de falhos que ninguém lê esconde bugs.

### 3.4 Garantias de entrega

| Garantia | Significado | Como fica |
|---|---|---|
| **No máximo uma vez** | Pode perder, nunca duplica | Envia e esquece, sem confirmação |
| **Pelo menos uma vez** | Nunca perde (se o sistema está saudável), pode duplicar | O padrão do BullMQ |
| **Exatamente uma vez** | Nem perde, nem duplica | Na prática, "pelo menos uma vez" + **idempotência** |

"Exatamente uma vez" de verdade é muito difícil em sistemas distribuídos. O padrão realista é aceitar duplicatas na entrega e **tornar a operação idempotente**.

### 3.5 Estratégias de idempotência

| Estratégia | Como funciona | Quando usar |
|---|---|---|
| **Constraint única + `ON CONFLICT`** | O banco recusa a duplicata (usado aqui) | Gravações em tabela |
| **Chave de idempotência** | Guarda ids processados e checa antes | Chamadas a serviços externos (pagamento) |
| **Operação naturalmente idempotente** | `SET status = 'done'` repetido dá o mesmo resultado | Atualizações de estado |
| **`jobId` determinístico** | A fila ignora jobs com o mesmo id | Reduz duplicatas, mas **não é garantia** (o id some após a retenção) |

### 3.6 Lote: quando e como

Agrupe quando a operação tem um custo fixo alto por chamada (insert no banco, requisição HTTP). O desenho tem sempre os mesmos elementos:

1. **Buffer** em memória.
2. **Limite de tamanho** e **limite de tempo**, o que vier primeiro (sem o de tempo, um evento sozinho esperaria para sempre).
3. **Confirmação só depois de gravar:** o job termina quando o lote persistiu, e não quando entrou no buffer.
4. **Falha parcial:** decida o que fazer quando um item ruim derruba o lote (aqui: regravar um a um e isolar o item ruim).
5. **Descarga no encerramento.**

O custo do lote é **latência**: o evento espera até `BATCH_FLUSH_MS` para ser gravado. Para métricas, 1 segundo é irrelevante.

### 3.7 Armadilhas frequentes

| Armadilha | Consequência |
|---|---|
| Sem `removeOnComplete`/`removeOnFail` | Redis enche; com `noeviction`, as escritas passam a falhar |
| `await` ao publicar quando a fila não é crítica | A latência da fila volta para a requisição |
| Gerar id ou horário no consumidor | A reentrega muda o valor e a idempotência quebra |
| Retry para erro permanente | Gasta tentativas e polui a fila de falhos |
| Concorrência menor que o lote | O lote nunca enche, só o timer descarrega |
| Compartilhar a conexão Redis entre fila e cache | As opções de falha rápida conflitam |
| Worker sem encerramento limpo | Perde o buffer a cada deploy |
| Ninguém monitora a fila | O atraso cresce sem alarme |

### 3.8 Limitações conhecidas deste projeto

Saiba apontá-las. É o que diferencia entender de copiar:

- **Cliques se perdem se o Redis estiver fora do ar.** O redirect continua, mas não há onde enfileirar. Resolver exigiria um buffer local ou um padrão **outbox** (gravar o evento no Postgres e outro processo o publicar).
- **Bots e pré-visualizações de link** (WhatsApp, Slack) também geram cliques. Estão marcados como `bot`, mas contam, a menos que a consulta os filtre.
- **A fila e o cache dividem o mesmo Redis.** Com `noeviction`, uma fila mal retida afeta tudo. Evolução possível: duas instâncias.
- **Partições mensais criadas à mão** até a Fase 6.
- **Sem monitoramento da fila** (tamanho, atraso, taxa de falha). Evolução: métricas com Prometheus e Grafana.

---

## Parte 4. Exercícios para consolidar

**Idempotência**

1. Rode o script `scripts/duplicate-test.ts` e confirme que o mesmo `eventId` enfileirado duas vezes resulta em **uma** linha.
2. Remova o `.onConflictDoNothing()` temporariamente e repita. Veja o erro de violação de unicidade e o job entrar em retry.

**Resiliência**

3. Desligue o worker, faça 20 redirects, olhe os jobs esperando no Redis (`redis-cli --scan --pattern "bull:click-events:*"`), ligue o worker e veja as linhas aparecerem.
4. Pare o Redis e faça redirects. Leia o aviso no log da API e confirme que o 302 continua saindo.
5. Mate o worker à força (`Stop-Process -Force`) durante uma rajada e confira se, depois de religar, a contagem fecha **sem duplicatas**.
6. Pare o Postgres por alguns segundos durante uma rajada e observe os retries com backoff no log.

**Lote**

7. Mude `BATCH_SIZE` para 5 e `BATCH_FLUSH_MS` para 5000. Dispare 3 cliques e meça quanto tempo levam para aparecer. Depois dispare 5.
8. Faça o experimento do link excluído: dispare cliques, exclua o link antes do worker processar e veja que o resto do lote é gravado normalmente.

**Desafios**

9. Adicione uma métrica simples: um log a cada minuto com quantos eventos foram gravados e o tamanho médio do lote.
10. Implemente um segundo tipo de job (por exemplo, `link-expired`) na mesma fila e escolha o tratamento pelo nome do job.
11. Esboce o padrão outbox para eliminar a perda de cliques com o Redis fora do ar: que tabela, que processo, quais garantias.

**Para conversar sobre o projeto (entrevistas)**

Você deve conseguir explicar, sem olhar o código:

- Por que o redirect não espera a fila.
- Por que a entrega é "pelo menos uma vez" e como a idempotência resolve as duplicatas.
- Por que o horário e o id do evento nascem na API.
- Como o lote preserva a garantia de entrega.
- Quais são as limitações do desenho e o que você faria para removê-las.

Essa última pergunta costuma contar mais pontos do que a implementação em si.