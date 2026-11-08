# Guia de estudo: cache e rate limiter

Este guia explica o código da Fase 3 do projeto e o que levar dele para outros contextos. Ele não substitui ler o código: a ideia é que você o leia **com um mapa na mão**.

**Como usar:** abra os arquivos reais ao lado deste guia, siga a ordem de leitura sugerida e, no fim de cada parte, tente responder às perguntas de verificação sem olhar o código.

---

## Parte 0. Conceitos que valem para os dois

| Conceito | O que é | Onde aparece |
|---|---|---|
| **Redis** | Banco chave-valor em memória, muito rápido | Cache, contadores do rate limiter, sessões, fila |
| **TTL** | Tempo de vida de uma chave; depois dele o Redis a apaga sozinho | Toda chave do projeto tem um |
| **Atomicidade** | Uma operação que acontece inteira ou não acontece, sem ninguém "no meio" | Script Lua do rate limiter |
| **Degradação** | O sistema continua funcionando, de forma pior, quando uma peça falha | Cache falha: vai ao Postgres. Rate limiter falha: libera a requisição |
| **Fail-open / fail-closed** | O que fazer quando o mecanismo de proteção falha: liberar ou bloquear | Rate limiter usa fail-open |

Uma decisão do projeto que explica várias linhas: o Redis roda com `maxmemory-policy noeviction` (decisão 001). Ele **nunca apaga chaves por falta de memória**, porque a fila (BullMQ) perderia jobs. Por isso **toda chave de cache e de rate limit precisa de TTL**. Sem TTL, ela ficaria para sempre e a memória encheria.

---

## Parte 1. Como ler o módulo do rate limiter

### 1.1 O que ele resolve

Limitar quantas requisições um cliente pode fazer em um período. No projeto, protege contra força bruta no login, criação em massa de contas e links, e varredura no redirect.

### 1.2 Ordem de leitura

Leia na ordem em que uma requisição atravessa o módulo, e não em ordem alfabética.

```
1. rate-limit.policies.ts     Quais são as regras? (só dados)
2. token-bucket.lua.ts        Como se decide permitir ou negar? (o algoritmo)
3. rate-limiter.service.ts    Como o Node chama o algoritmo no Redis?
4. rate-limit.guard.ts        Como isso vira um 429 em uma rota?
5. rate-limit.decorator.ts    Como uma rota declara qual regra usar?
6. rate-limiter.module.ts     Como o Nest conecta tudo?
7. (uso) @RateLimit('login') nos controllers
```

### 1.3 Arquivo por arquivo

#### `rate-limit.policies.ts`: as regras como dados

Cada política tem três campos:

- `capacity`: o tamanho do balde, ou seja, quantas requisições seguidas são permitidas (a **rajada**).
- `refillPerSecond`: quantas "fichas" voltam ao balde por segundo (o **ritmo sustentado**).
- `by`: quem é contado, o `ip` ou o `user`.

Leia `login: { capacity: 10, refillPerSecond: 10/60, by: 'ip' }` assim: *"cada IP pode tentar login 10 vezes de uma vez; depois disso, ganha uma nova tentativa a cada 6 segundos"*.

Ponto de design: manter os números em um único arquivo permite ajustar e documentar os limites sem mexer em lógica.

O `as const satisfies Record<string, RateLimitPolicy>` faz duas coisas: `satisfies` confere que cada política tem o formato certo, e `as const` preserva os nomes (`'login'`, `'redirect'`...) como tipos literais. É isso que faz `@RateLimit('logn')` dar erro de compilação.

#### `token-bucket.lua.ts`: o algoritmo

Este é o coração. Antes do código, a ideia:

> Cada cliente tem um balde com até `capacity` fichas. Cada requisição gasta 1 ficha. As fichas voltam a uma taxa constante. Sem ficha, a requisição é negada.

O script, passo a passo:

1. **Lê a hora** do próprio Redis (`TIME`). Usar o relógio do Redis, e não o do Node, evita que várias instâncias da API discordem sobre "agora".
2. **Lê o estado** guardado (`tokens` e `ts`, o instante da última atualização). Se não existe, o cliente é novo e começa com o balde cheio.
3. **Reabastece:** `tokens = min(capacity, tokens + segundosPassados * refill)`. O `min` impede o balde de passar da capacidade.
4. **Decide:** se `tokens >= 1`, gasta uma e permite. Senão, calcula em quantos ms haverá uma ficha (`retry_ms`).
5. **Grava** o novo estado e define um TTL (`PEXPIRE`) igual ao tempo que o balde leva para encher por completo. Depois disso, a chave não guarda mais informação nenhuma e pode sumir.
6. **Retorna** `{ permitido, fichasRestantes, msParaTentarDeNovo }`.

**Por que Lua e não vários comandos no Node?** Sem Lua, o fluxo seria "lê saldo, calcula, grava". Duas requisições simultâneas leem o mesmo saldo e ambas passam (uma **condição de corrida**). O Redis executa o script inteiro sem intercalar outros comandos, então a leitura e a gravação formam uma unidade indivisível.

#### `rate-limiter.service.ts`: a ponte Node ↔ Redis

- `defineCommand('tokenBucket', ...)` registra o script no ioredis, que passa a tratá-lo como um método. Internamente usa `EVALSHA` (envia só o hash do script depois da primeira vez) e recarrega o script se o Redis o esquecer.
- `consume(policy, identifier)` monta a chave `rl:<política>:<identificador>`, chama o script e traduz o resultado.
- **Interruptor:** se `RATE_LIMIT_ENABLED` é falso, devolve "permitido" sem consultar o Redis. Existe para testes e para o teste de carga.
- **Fail-open:** no `catch`, se o Redis falhar, a requisição é liberada e o erro é registrado. É uma escolha consciente: nesta aplicação, o redirect disponível vale mais que a proteção. Em um endpoint de pagamento, por exemplo, você poderia escolher o contrário.

#### `rate-limit.guard.ts`: de decisão a resposta HTTP

Um **guard** do Nest roda antes do controller e responde "pode seguir ou não". Leia o `canActivate` em quatro blocos:

1. **Descobre a política da rota** com o `Reflector`, que lê os metadados gravados pelo decorator. Se a rota não tem política, libera.
2. **Escolhe o identificador:** `user:<id>` se a política é por usuário e a sessão existe; senão `ip:<ip>`.
3. **Consome uma ficha** pelo service e coloca o saldo no header `X-RateLimit-Remaining`.
4. **Se negado**, define `Retry-After` e lança uma exceção com status 429.

Detalhe importante sobre a ordem: guards de classe (como o `AuthGuard`) rodam **antes** dos de método. Por isso, em `createLink`, o `userId` já está na requisição quando o `RateLimitGuard` roda. Um guard global não teria essa garantia.

#### `rate-limit.decorator.ts`: a API para o resto do código

```ts
applyDecorators(SetMetadata(RATE_LIMIT_KEY, policy), UseGuards(RateLimitGuard))
```

Isso faz duas coisas ao mesmo tempo: **grava** o nome da política na rota (metadado) e **liga** o guard. Por isso basta escrever `@RateLimit('login')`. O `Reflector` do guard lê exatamente a mesma chave (`RATE_LIMIT_KEY`) que o `SetMetadata` gravou. Se as duas chaves divergirem, nenhum limite é aplicado, e nenhum erro aparece.

#### `rate-limiter.module.ts`

Declara o service como provider e o exporta. É `@Global()` porque o guard é instanciado no módulo de cada rota que o usa (auth, links, redirect...) e todos precisam enxergar o `RateLimiterService`. Para o `@Global()` valer, o módulo precisa estar nos `imports` do `AppModule`. Sem isso, o Nest dá o erro "can't resolve dependencies of RateLimitGuard".

### 1.4 Rastreando uma requisição

`POST /api/auth/login` na 11ª tentativa do mesmo IP:

```
Cliente → Caddy (adiciona X-Forwarded-For)
        → Nest resolve req.ip (por causa do trust proxy)
        → RateLimitGuard: política 'login', identificador 'ip:1.2.3.4'
        → RateLimiterService → Redis roda o script
        → script: tokens < 1 → retorna { 0, 0, 6000 }
        → Guard: Retry-After: 6, lança 429
        → o controller nunca é executado
```

### 1.5 Perguntas de verificação

1. Por que o balde tem TTL, e qual é o valor dele?
2. O que aconteceria se o `Reflector` lesse uma chave diferente da usada no `SetMetadata`?
3. Por que `req.ip` só é confiável com `trust proxy` configurado?
4. Por que o limite de `createLink` é por usuário, e o de `login` por IP?
5. Em que situação você trocaria fail-open por fail-closed?

---

## Parte 2. Como ler o módulo do cache

### 2.1 O que ele resolve

O redirect é a operação mais frequente do sistema: **muitas leituras para poucas escritas**. Sem cache, cada clique faz uma consulta ao Postgres. Com cache, a maioria dos cliques é respondida pelo Redis, que é muito mais rápido.

### 2.2 Ordem de leitura

```
1. cache.constants.ts          TTLs e formato da chave
2. link-cache.service.ts       A API do cache (get, set, invalidate)
3. redirect.service.ts         O cache em ação (padrão cache-aside)
4. links.service.ts            Onde o cache é invalidado (criar, editar, excluir)
5. accounts.service.ts         Invalidação em massa (exclusão de conta)
6. cache.module.ts             Conexão com o Nest
```

### 2.3 Arquivo por arquivo

#### `cache.constants.ts`

- `LINK_CACHE_TTL_SECONDS` (1 hora) é o **teto de obsolescência**: se uma invalidação falhar, o dado errado vive no máximo esse tempo.
- `NEGATIVE_CACHE_TTL_SECONDS` (60 s) vale para "não existe". É curto porque o código pode ser criado logo depois.
- `linkKey(code)` centraliza o formato `link:<código>`. Ter a função em um só lugar evita a bug clássica de gravar com uma chave e invalidar com outra.

#### `link-cache.service.ts`

O tipo `CachedLink` tem duas formas: `{ found: true, longUrl, status, expiresAt }` e `{ found: false }`. A segunda é o **cache negativo**: guardar "esse código não existe" para que alguém varrendo códigos aleatórios não derrube o banco.

Os métodos:

| Método | Falha do Redis | Por quê |
|---|---|---|
| `get` | Engole o erro, devolve `null` | Sem cache, o redirect vai ao Postgres. Mais lento, mas funciona |
| `setFound` / `setNotFound` | Engole o erro (`safeSet`) | Não gravar no cache só perde otimização |
| `invalidate` | **Deixa o erro subir** | Se não apagar, um link desativado continuaria redirecionando |

A regra por trás da tabela: **falhar ao ler ou preencher é seguro; falhar ao invalidar não é**.

O `ttlFor` calcula o TTL de um link: o menor entre 1 hora e o tempo até `expiresAt`. Assim o cache nunca sobrevive ao vencimento do link.

O `invalidate` apaga em lotes de 500 chaves, porque a exclusão de uma conta com milhares de links geraria um único comando enorme.

#### `redirect.service.ts`: o padrão cache-aside

Este é o padrão que você mais vai reencontrar. O fluxo:

```
1. Valida o formato do código (barra lixo antes de tocar em qualquer coisa)
2. Procura no cache
   └─ achou → HIT: avalia o estado e responde
3. Não achou → MISS: procura no Postgres
   ├─ não existe → grava "não existe" no cache, responde 404
   └─ existe     → grava no cache, avalia o estado e responde
```

Dois detalhes que valem atenção:

- A função `toUrl` é usada **tanto no hit quanto no miss**. O estado do link (`inactive`, expirado) é avaliado a cada requisição, e não congelado no cache. Assim, uma única regra vale nos dois caminhos.
- O header `X-Cache: HIT|MISS` (no controller) existe para você **provar** que o cache funciona, em testes e em demonstrações.

#### Invalidação (`links.service.ts` e `accounts.service.ts`)

O cache só é útil se não mentir. Toda operação que muda um link precisa apagar a chave dele:

| Operação | Invalida | Motivo |
|---|---|---|
| Criar link | O código novo | Pode haver um "não existe" em cache para esse código |
| Desativar/ativar | O código do link | O estado em cache ficou velho |
| Excluir link | O código do link | Senão ele continuaria redirecionando |
| Excluir conta | Os códigos de todos os links | Os links foram desativados em massa |

Por isso `delete` e `softDelete` nos repositories passaram a **devolver os códigos** (`returning`): o service precisa saber o que invalidar.

### 2.4 Rastreando uma requisição

`GET /AbC1234`, primeiro e segundo acessos:

```
1º acesso: Redis GET link:AbC1234 → vazio
           Postgres SELECT → encontrou
           Redis SET link:AbC1234 ... EX 3600
           302 com X-Cache: MISS

2º acesso: Redis GET link:AbC1234 → encontrou
           302 com X-Cache: HIT (o Postgres nem é consultado)
```

### 2.5 Perguntas de verificação

1. Por que `invalidate` não engole erros, mas `get` engole?
2. O que impede o cache de servir um link depois da data de expiração?
3. Por que o cache é por `short_code` e não por usuário?
4. Que bug surge se a gravação usa `link:${code}` e a invalidação usa `links:${code}`?
5. O que acontece com o redirect se o Redis ficar fora do ar?

---

## Parte 3. O básico para implementar cada um em um contexto geral

Os exemplos usam `ioredis` e não dependem de Nest.

### 3.1 Cache: o mínimo que funciona

**Leitura (cache-aside):**

```ts
async function getUser(id: string) {
  const key = `user:${id}`;

  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const user = await db.findUser(id);
  if (user) await redis.set(key, JSON.stringify(user), 'EX', 300);
  return user;
}
```

**Escrita (invalidar, não atualizar):**

```ts
async function updateUser(id: string, data: Partial<User>) {
  await db.updateUser(id, data);
  await redis.del(`user:${id}`);
}
```

Prefira **apagar** a chave a reescrevê-la: a próxima leitura repreenche com o dado do banco. Atualizar o cache na escrita abre mais janelas para inconsistência.

**Checklist para decidir se vale cachear algo:**

1. A leitura é muito mais frequente que a escrita?
2. Posso tolerar um dado levemente desatualizado, e por quanto tempo? (Isso define o TTL.)
3. Sei listar **todos** os lugares que alteram esse dado? (Isso define a invalidação.)
4. O que acontece se o Redis cair? (Deve degradar, não quebrar.)

**Regras gerais:**

- Toda chave com TTL.
- Centralize a montagem das chaves em uma função.
- Serialize só o que precisa (não guarde o objeto inteiro do banco).
- Falha de leitura vira miss; falha de invalidação deve ser vista.

**Problemas conhecidos (saiba que existem):**

| Problema | Descrição | Mitigação |
|---|---|---|
| **Cache stampede** | Uma chave popular expira e muitas requisições vão ao banco juntas | Lock por chave, TTL com variação aleatória, renovação antecipada |
| **Corrida preenchimento × invalidação** | Uma leitura antiga grava no cache logo depois de uma invalidação | TTL curto, versionamento de chave |
| **Penetração** | Consultas a dados que não existem sempre chegam ao banco | Cache negativo, filtro de Bloom |

### 3.2 Rate limiter: o mínimo que funciona

**Opção mais simples: janela fixa.**

```ts
async function allow(key: string, limit: number, windowSeconds: number) {
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSeconds);
  return count <= limit;
}
```

Funciona, mas tem dois defeitos que você deve conhecer:

- **Não é atômico:** se o processo cair entre `incr` e `expire`, a chave fica sem TTL para sempre. Corrija usando `redis.multi()` ou um script Lua.
- **Efeito de borda:** com limite de 100 por minuto, um cliente pode fazer 100 requisições no fim de uma janela e 100 no começo da próxima, ou seja, 200 em poucos segundos.

**Comparação dos algoritmos:**

| Algoritmo | Ideia | Prós | Contras |
|---|---|---|---|
| **Janela fixa** | Contador por intervalo de tempo | Trivial | Rajadas na borda da janela |
| **Janela deslizante (log)** | Guarda o horário de cada requisição | Preciso | Mais memória |
| **Janela deslizante (contador)** | Mistura a janela atual e a anterior | Barato e quase preciso | Aproximado |
| **Token bucket** | Fichas que se recompõem | Permite rajada controlada e ritmo estável | Dois parâmetros para ajustar |
| **Leaky bucket** | Fila que escoa em ritmo fixo | Saída perfeitamente suave | Não permite rajadas |

O projeto usa token bucket porque o uso real é em rajadas (um usuário abre várias páginas de uma vez) e o objetivo é barrar abuso sustentado, não penalizar o uso normal.

**Decisões que você sempre vai precisar tomar:**

1. **Quem é contado?** IP, usuário, chave de API, ou combinação. IP erra de dois jeitos: usuários atrás do mesmo NAT se bloqueiam entre si, e um atacante distribuído usa muitos IPs.
2. **Quais limites?** Por rota e por sensibilidade. Login e cadastro têm limites bem mais apertados que leitura.
3. **E se o limitador falhar?** Fail-open (disponibilidade primeiro) ou fail-closed (segurança primeiro).
4. **Como informar o cliente?** Status `429`, header `Retry-After`, e opcionalmente `X-RateLimit-Remaining`.
5. **Onde mora o estado?** Em memória só funciona com uma instância. Com várias instâncias, o estado precisa ser compartilhado (Redis).

**Esqueleto de um token bucket sem Lua (para entender, não para produção):**

```ts
// Não é atômico: duas requisições simultâneas podem ler o mesmo saldo.
async function allow(key: string, capacity: number, refillPerSec: number) {
  const now = Date.now();
  const data = await redis.hgetall(key);
  let tokens = data.tokens ? Number(data.tokens) : capacity;
  const last = data.ts ? Number(data.ts) : now;

  tokens = Math.min(capacity, tokens + ((now - last) / 1000) * refillPerSec);
  const allowed = tokens >= 1;
  if (allowed) tokens -= 1;

  await redis.hset(key, { tokens, ts: now });
  await redis.expire(key, Math.ceil(capacity / refillPerSec) + 1);
  return allowed;
}
```

Compare com o script Lua do projeto: a lógica é a mesma, e a diferença é que o Lua faz tudo isso como **uma única operação indivisível**. Essa comparação é um bom exercício para fixar o motivo da atomicidade.

**O que o rate limiter não é:** proteção contra DDoS de verdade. Um limitador na aplicação mitiga abuso e erro de cliente. Ataques volumétricos precisam ser barrados antes, na borda (CDN, WAF, firewall).

---

## Parte 4. Exercícios para consolidar

Fazer estes exercícios mostra mais domínio do que ler o código várias vezes.

**Cache**

1. Mude o TTL do link para 10 segundos, acesse um link duas vezes, espere, e acesse de novo. Observe o `X-Cache` e a chave com `redis-cli ttl`.
2. Comente a chamada `cache.invalidate` do `setStatus`, desative um link já cacheado e veja o redirect continuar respondendo 302. Depois restaure. É a melhor forma de entender por que a invalidação importa.
3. Com o Redis parado, faça um redirect e leia o log. Depois ligue o Redis e veja o cache voltar.
4. **Desafio:** implemente uma proteção simples contra stampede (um lock `SET NX` por código durante o preenchimento).

**Rate limiter**

1. Mude `login` para `capacity: 3` e dispare tentativas com um laço até ver o 429 e o `Retry-After`.
2. Mude `refillPerSecond` e meça quanto tempo leva para voltar a permitir.
3. Inspecione uma chave: `redis-cli hgetall rl:login:ip:...` e `pttl`. Veja `tokens` e `ts` mudando.
4. **Desafio:** adicione um segundo balde por **email** no login (além do por IP), para barrar ataques distribuídos contra uma única conta.
5. **Desafio:** troque o token bucket por janela deslizante e compare o comportamento nos testes e2e.

**Para conversar sobre o projeto (entrevistas)**

Você deve conseguir explicar, sem olhar o código:

- Por que o cache é por código e não por usuário.
- Por que a invalidação não é "melhor esforço" e a leitura é.
- Por que o token bucket roda em Lua.
- Quais são as limitações conhecidas do seu cache e do seu rate limiter, e o que você faria para resolvê-las.

Essa última pergunta costuma contar mais pontos do que a implementação em si.