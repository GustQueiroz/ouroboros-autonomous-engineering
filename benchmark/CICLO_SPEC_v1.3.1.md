# CICLO — Especificação de Escopo

Simulador de carreira de trading de criptomoedas fictícias. Dinheiro fictício, ativos fictícios, mundo determinístico.

Versão da spec: 1.3.1
Codinome do repositório: `ciclo`
Idioma do código, identificadores, commits e documentação técnica: inglês
Idioma da interface do jogo: português do Brasil
Plataforma: aplicação Electron desktop, integralmente local, com instalador para Windows e Linux

---

## 0. Como ler este documento

Este documento é normativo. Ele define restrições, não sugestões.

- **TRAVADO** — decisão fechada. Não reabrir, não reinterpretar, não "melhorar". Alterar exige ADR de revogação aprovado explicitamente pelo dono do produto.
- **DEFINIR** — decisão delegada ao time. Precisa de ADR registrado antes da implementação.
- **INV-nn** — invariante do sistema. Cada uma precisa de teste automatizado permanente. Invariante sem teste é feature incompleta.
- **FASE-n** — bloco de entrega com critério de aceite objetivo.

Se algum trecho deste documento conflitar com outro, o conflito é um bug da spec. Registre e pergunte. Não escolha silenciosamente.

---

## 1. Visão do produto

O jogador é um trader iniciante com R$ 50.000,00 fictícios. Ele opera um mercado de criptomoedas fictícias ao longo de anos de tempo de jogo, cumprindo metas de campanha e missões secundárias, subindo em uma leaderboard mundial de 100 investidores fictícios, e interagindo com esses investidores.

O mundo é gerado por uma seed. A mesma seed produz sempre o mesmo mercado, os mesmos eventos macro, os mesmos patrimônios de bots e o mesmo comportamento-base dos NPCs. As dicas de NPC são moduladas pela confiança acumulada e portanto dependem do histórico do jogador: dada a mesma seed e o mesmo histórico de ações, as mesmas dicas são produzidas. O resultado do jogador depende exclusivamente das decisões dele.

O estado final de uma partida é função exclusiva de três entradas: `masterSeed`, o log de ações e `finalTick`. Duas partidas com as três entradas idênticas produzem estados idênticos byte a byte.

Nada aqui afirma o contrário: sequências de ações diferentes podem convergir para o mesmo estado, e isso é legítimo. O que a spec garante é determinismo, não injetividade. Quem confunde as duas coisas escreve teste que falha por motivo errado.

O produto final é jogável. Não é um protótipo de motor.

---

## 2. Anti-escopo

Construir qualquer um dos itens abaixo é desvio de escopo e será rejeitado na revisão.

- Integração com exchange, API de preços reais ou blockchain real
- Nomes de criptomoedas reais, tickers reais, logotipos reais
- Motor de gráfico próprio. Usar `lightweight-charts`. Proibido reescrever, envolver em abstração de 4 camadas ou substituir
- Multiplayer em tempo real, matchmaking, chat entre jogadores
- Sistema de pagamento, monetização, compras
- Aplicativo mobile nativo, versão web hospedada
- Autenticação federada, OAuth, gestão de identidade. Perfil local basta
- Backend, servidor, leaderboard compartilhada. A aplicação é integralmente local
- Auto-update, telemetria remota, coleta de dados
- Assinatura de código e notarização
- Motor de física, 3D, animação procedural
- Qualquer conselho financeiro real. O jogo exibe aviso permanente de que se trata de simulação com ativos inexistentes

---

## 3. Decisões arquiteturais travadas

Estas dez decisões existem porque cada uma delas, se violada, causa dano retroativo e não corrigível localmente. Todas são **TRAVADAS**.

### ADR-001 — Tempo de jogo é um inteiro, nunca um relógio

A unidade de tempo do domínio é o `Tick`. Um tick equivale a um minuto de tempo de jogo. `Tick` é um inteiro não negativo monotônico a partir de zero.

Nenhum módulo de domínio pode ler `Date.now()`, `new Date()`, `performance.now()`, timers ou qualquer fonte de tempo do sistema. A conversão entre tick e data legível é responsabilidade exclusiva da camada de apresentação.

Progressão de tempo real, offline ou acelerada é convertida em uma quantidade de ticks pela camada de aplicação e entregue ao domínio como número.

### ADR-002 — Aleatoriedade é posicional, nunca sequencial

Proibido PRNG com estado. Proibido `Math.random()`. Proibido qualquer gerador cujo próximo valor dependa de quantas vezes foi chamado.

Toda aleatoriedade do mundo é uma função pura indexada:

```
rand(masterSeed, namespace, ...coordinates) -> uint64
```

Namespaces reservados, cada um isolado dos demais:

| Namespace | Coordenadas |
|---|---|
| `market.trend` | assetId, octave, blockIndex |
| `market.factor` | octave, blockIndex |
| `market.regime` | blockIndex |
| `macro.schedule` | windowIndex |
| `macro.payload` | windowIndex, slot |
| `bot.policy` | botId |
| `bot.decision` | botId, tick |
| `npc.tip.truth` | npcId, questId, attempt |
| `npc.tip.payload` | npcId, questId, attempt |
| `quest.roll` | questId, attempt |
| `venue.liquidity` | assetId, blockIndex |

Consequência exigida: consultar o estado do mundo no tick 9.000.000 diretamente deve produzir exatamente o mesmo valor que chegar ao tick 9.000.000 avançando um tick por vez. Este é o teste mais importante do projeto.

Consequência exigida: nenhuma ação do jogador pode alterar qualquer valor do mundo base. Abrir um diálogo, mudar de aba, redimensionar a janela ou executar uma ordem não desloca o mercado gerado.

A função de hash é **DEFINIR**, com duas restrições travadas: precisa ser especificada bit a bit em ADR, e não pode ser a função de hash nativa da linguagem ou da estrutura de dados. Recomendação de partida: SplitMix64 sobre um acumulador FNV-1a dos argumentos.

### ADR-003 — Proibido ponto flutuante no domínio

Nenhum valor econômico, preço, quantidade, taxa, ruído ou coordenada temporal pode transitar como `number` de ponto flutuante dentro do domínio.

Motivo: acumulação em `double` divergir no décimo terceiro decimal é suficiente para uma liquidação acontecer em uma execução e não acontecer no replay. Além disso, `Math.sin`, `Math.exp`, `Math.pow` e `Math.log` não têm resultado especificado pelo IEEE-754 e variam entre engines e arquiteturas. Usar qualquer uma delas destrói o determinismo entre plataformas.

Tipos monetários travados:

| Tipo | Representação | Escala |
|---|---|---|
| `Money` | int64 | 1 unidade = 1 centavo de BRL |
| `Quantity` | int64 | 1 unidade = 1e-8 do ativo (`QUANTITY_SCALE = 100_000_000`) |
| `Price` | int64 | 1 unidade = 1e-4 centavo por 1 unidade inteira do ativo (`PRICE_SCALE = 10_000`) |
| `Rate` | int64 | 1 unidade = 1e-8 (`RATE_SCALE = 100_000_000`) |

Representação concreta em TypeScript, travada. `number` é IEEE-754 e não existe int64 nativo, então a regra é:

| Categoria | Representação | Justificativa |
|---|---|---|
| `Money`, `Quantity`, `Price`, `Rate` | `bigint` com tipo nominal (branded) | Podem exceder 2^53 em nocional e acumulação |
| Intermediários de multiplicação e divisão | `bigint` | Produto de `Quantity` por `Price` chega a 1e27 |
| `Tick` | `number` com tipo nominal, restrito a inteiro seguro | Ver justificativa abaixo |
| Ruído interno do gerador, contadores, índices de bloco e oitava | `number` com tipo nominal, restrito a inteiro seguro | Ver justificativa abaixo |

`Tick` e o núcleo aritmético do gerador de mercado usam `number` restrito a inteiro seguro, não `bigint`, por dois motivos concretos. Primeiro, `bigint` é uma ordem de magnitude mais lento que `number` em operação escalar, e o gerador de preço executa na casa de dezenas de milhões de operações dentro do orçamento de 5s para replay de um ano. Segundo, inteiro dentro de 2^53 representado em `double` é exato e bit-idêntico em qualquer plataforma que implemente IEEE-754, o que preserva o determinismo. `Tick` máximo com folga de mil anos de jogo é 5,3e8, três ordens de magnitude abaixo do limite seguro.

Condições travadas para o uso de inteiro seguro:

- Todo valor tem tipo nominal e construtor validador que rejeita não-inteiro e valor fora de `[-(2^53-1), 2^53-1]`
- Operadores `/` e `**` são proibidos sobre esses tipos. Divisão só por helper com modo de arredondamento explícito conforme ADR-004
- Toda multiplicação cujo resultado possa exceder 2^53 é erro de projeto. Se o limite não for provável estaticamente, o valor pertence a `bigint`
- `Math.floor` e `Math.trunc` são permitidos. Qualquer outra função de `Math` continua proibida
- Existe teste de propriedade que verifica ausência de estouro do limite seguro em execução longa

Conversão de nocional:

```
notionalCents = (quantityRaw * priceRaw) / (QUANTITY_SCALE * PRICE_SCALE)
```

O produto intermediário estoura int64. Todo cálculo intermediário roda em inteiro de precisão arbitrária (`bigint`) ou 128 bits, com truncamento explícito apenas na fronteira de escrita no ledger.

Funções transcendentais necessárias ao gerador de mercado precisam ser implementadas em ponto fixo próprio ou por tabela de lookup interpolada linearmente, com resultado idêntico em qualquer plataforma. Documentar em ADR.

### ADR-004 — Toda divisão declara seu modo de arredondamento

Não existe divisão implícita. Toda operação que perde precisão recebe um modo explícito: `TRUNCATE_TOWARD_ZERO`, `ROUND_HALF_UP` ou `ROUND_HALF_EVEN`.

Chamar divisão sem modo é erro de compilação ou erro de lint bloqueante. **DEFINIR** como isso é imposto tecnicamente.

O resíduo de arredondamento nunca desaparece. Ele é lançado na conta `world:rounding_residue:<COMMODITY>` correspondente para que a dupla entrada feche naquela commodity. Dinheiro que evapora em arredondamento é bug, não detalhe.

### ADR-005 — O tick base não tem OHLC

O preço em um tick base é um valor pontual único: `price(assetId, tick) -> Price`.

Candles de 1m, 5m, 15m, 1h, 4h e 1d são agregações determinísticas de ticks base, calculadas na leitura.

Motivo: um candle OHLC é ambíguo quanto ao caminho intra-candle. Não se sabe se a máxima veio antes ou depois da mínima, e essa ambiguidade decide se um stop disparou antes de uma liquidação. Eliminando OHLC do nível base, o caminho do preço passa a ser a própria sequência de ticks e a ambiguidade deixa de existir.

Trade-off aceito e registrado: não existe pavio de preço com granularidade menor que um minuto de jogo. Isso é aceitável para o produto.

### ADR-006 — Save é seed, log de ações e duração

O arquivo de save é:

```
{
  specVersion: string
  rulesetVersion: string
  encodingVersion: string
  masterSeed: string
  finalTick: Tick
  actions: Array<{ tick: Tick, sequence: number, type: string, payload: object }>
  checkpoint?: { tick: Tick, stateHash: string, blob: object }
}
```

O estado do jogo nunca é a fonte da verdade. Ele é derivado do replay de `actions` sobre `masterSeed` até `finalTick`.

`finalTick` é entrada, não estado derivado. Ele representa a duração da partida, não um resumo do resultado. Sem ele o save é incompleto: um jogador que opera no tick 100 e depois acelera até o tick 1.000.000 sem agir tem log terminando em 100, e o replay não teria como saber onde a partida parou. O log diz o que foi feito; `finalTick` diz até quando o mundo correu.

Regras travadas do envelope:

- `finalTick` é maior ou igual ao maior `tick` presente em `actions`. Violação significa save corrompido, e o carregamento falha em vez de tentar reparar
- O par `(tick, sequence)` é único no log e define ordem total. `sequence` é monotônico crescente dentro de um mesmo tick, começando em zero
- Duas ações com o mesmo `(tick, sequence)` significam save corrompido
- Comandos de controle de tempo não são ações. Acelerar, pausar ou saltar não entram no log, porque não são decisões econômicas e não alteram o resultado. O que altera o resultado é até onde o mundo correu, e isso é `finalTick`

`checkpoint` existe apenas como cache de performance, é descartável e precisa ser validado contra o replay puro por teste automatizado.

Consequência exigida: todo relato de bug se torna um caso reproduzível determinístico. A unidade de reprodução é o save canônico completo, não a seed nem o log isolados, porque o envelope carrega `finalTick`, `rulesetVersion` e `encodingVersion`, e qualquer um dos três altera o resultado.

Um relato de defeito válido contém: o save canônico completo, o tick em que o defeito se manifesta, e a invariante violada quando houver. Relato sem save completo é relato inválido e não entra na fila de trabalho.

### ADR-007 — O mundo é exógeno, o impacto do jogador é uma camada aditiva

Os 100 bots da leaderboard não reagem ao jogador. Suas políticas e curvas de patrimônio são função apenas da seed e do tick, o que permite pré-computação e consulta em O(1).

O jogador afeta o preço executado, não o preço do mundo:

```
effectivePrice(assetId, tick) = worldPrice(assetId, tick) + playerImpact(assetId, tick)
```

`playerImpact` é derivado exclusivamente do log de ações, decai ao longo dos ticks, e é função determinística do tamanho das ordens contra a liquidez do ativo. O preço do mundo permanece intocado.

O decaimento tem janela finita travada: o impacto de uma execução é exatamente zero após `IMPACT_WINDOW` ticks. Sem essa restrição, calcular `effectivePrice` no tick `t` exigiria varrer todo o log de ações desde o início da partida, e `effectivePrice` deixaria de caber no orçamento de performance em partidas longas. Com a janela, só as execuções dos últimos `IMPACT_WINDOW` ticks entram na conta. O valor de `IMPACT_WINDOW` é **DEFINIR**, com o requisito de que o corte seja exato e não assintótico: decaimento que tende a zero mas nunca chega a zero é proibido.

Única exceção autorizada à exogeneidade: NPCs com quem o jogador tem relacionamento em missão têm a qualidade e a frequência das dicas moduladas pelo nível de confiança acumulado. A modulação é determinística, indexada por `(npcId, questId, attempt)`, e não afeta preços.

### ADR-008 — O motor decide os números, o modelo de linguagem apenas escreve o texto

Nenhuma decisão com consequência econômica ou de progressão pode ser tomada por um modelo de linguagem.

O motor decide: a direção e a magnitude de um evento macro, se uma dica de NPC é verdadeira ou falsa, se uma missão foi cumprida, qual o patrimônio de um bot, quanto o jogador ganhou ou perdeu.

O modelo de linguagem recebe um contexto estruturado já resolvido e devolve texto: a manchete da notícia, a fala do NPC, o comentário do post-mortem.

Restrições travadas:

- O jogo precisa ser 100% jogável com a camada de linguagem desligada. Existe um gerador de texto por template determinístico como caminho padrão. O modelo é enriquecimento opcional.
- Nenhum número presente no texto gerado pode faltar no contexto estruturado de entrada. Existe um validador que extrai numerais do texto e verifica pertinência a uma whitelist derivada do contexto. Falha na validação cai para o template.
- Nenhuma chamada a modelo de linguagem no caminho de execução de testes. O CI roda com a camada desligada.

### ADR-009 — Codificação canônica de estado

Exigir igualdade byte a byte e igualdade entre plataformas sem definir o que são esses bytes é exigência vazia. Em JavaScript, a ordem de propriedades de um objeto depende da ordem de inserção, chaves que parecem numéricas são reordenadas por valor, `bigint` não tem representação em JSON, e `undefined` desaparece na serialização. Dois caminhos de código que produzem o mesmo estado lógico podem produzir bytes diferentes.

A FASE-1 precisa entregar um `CanonicalEncoder` especificado em ADR próprio, com no mínimo:

- Ordenação normativa de chaves por comparação de bytes UTF-8, aplicada recursivamente
- Representação de `bigint` como decimal ASCII com sinal explícito, sem zeros à esquerda, sem notação exponencial
- Representação de inteiro seguro distinta da de `bigint`, com marcador de tipo, para que `1n` e `1` nunca colidam no hash
- Proibição de `undefined`, `NaN`, `Infinity` e `-0` no estado canônico. Ocorrência é erro, não é normalizada em silêncio
- Codificação explícita de coleções ordenadas e não ordenadas, com ordenação normativa das não ordenadas
- `encodingVersion` participa do hash

Existem dois hashes distintos e eles não devem ser confundidos.

**`StateHash`** é o hash do estado lógico em um tick. Serve à comparação por tick do gate de CI e à detecção do primeiro tick divergente.

Entra: saldos de todas as contas do ledger, posições abertas, ordens pendentes, margem alocada, `currentTick`, estado das missões, confiança de NPC, patrimônio do jogador, e o resultado das entradas do ledger no tick.

Não entra `finalTick`. Isso é deliberado e corrige um defeito que quebraria o instrumento de medição: se `finalTick` participasse do `StateHash`, o hash do tick 500 dependeria de quanto a partida vai durar no futuro. Dois saves com a mesma seed e as mesmas ações até o tick 500, um com `finalTick` 1000 e outro com 2000, divergiriam no tick 500 sem que nada de fato tivesse divergido, e a comparação hash por tick do CI passaria a reportar falso positivo em toda partida de duração diferente. O estado em um tick não pode depender do futuro.

**`SaveHash`** é o hash do envelope persistido. Inclui `masterSeed`, o log de ações completo, `finalTick`, `specVersion`, `rulesetVersion` e `encodingVersion`. Serve à identidade do save, à deduplicação e ao anexo de relatos de defeito.

Toda invariante desta spec que menciona hash de estado refere-se a `StateHash`, com exceção explícita de INV-24, que compara identidade de save.

Não entra em nenhum dos dois: nenhum texto narrativo, nenhum campo de cache, nenhuma projeção derivada de leitura, nenhum dado de interface, nenhuma métrica de telemetria. Texto gerado por modelo de linguagem fora do estado canônico é o que permite ao CI ser determinístico com a camada desligada e continuar comparável com ela ligada.

### ADR-010 — Semântica de regras é versionada

`specVersion` versiona este documento. `rulesetVersion` versiona a semântica econômica: taxas, faixas de alavancagem, regras de margem, tributação, parâmetros do gerador de mercado.

Um save carrega o `rulesetVersion` sob o qual foi criado. O motor mantém os rulesets anteriores carregáveis. Replay de um save antigo usa o ruleset antigo e produz o mesmo estado de sempre.

Migração de ruleset é operação explícita, iniciada pelo jogador ou pelo teste, nunca implícita no carregamento. Migrar produz um novo estado, determinístico e reproduzível sob o ruleset novo, e o estado novo pode legitimamente diferir do antigo. Isso é o comportamento correto: uma regra de imposto que passa a valer retroativamente muda o saldo, e exigir que o saldo não mude é exigir que a regra não valha.

O que o teste verifica é a estabilidade das duas trilhas, não a igualdade entre elas:

- Replay sob ruleset antigo produz o hash antigo, sempre
- Migração do mesmo save produz sempre o mesmo hash novo
- A diferença entre os dois estados é explicável linha por linha pelas entradas de ledger que a migração gerou

---

## 4. Modelo de domínio

Glossário travado. Estes são os termos do código. Sinônimos são proibidos.

| Termo | Significado |
|---|---|
| `Tick` | Um minuto de tempo de jogo. Inteiro monotônico a partir de zero |
| `Asset` | Criptomoeda fictícia negociável |
| `Instrument` | Par negociável. `SPOT:ORB-BRL` ou `PERP:ORB-BRL` |
| `Order` | Intenção de negociação submetida pelo jogador |
| `Fill` | Execução parcial ou total de uma ordem |
| `Position` | Exposição líquida em um instrumento |
| `Account` | Conta do ledger de dupla entrada |
| `Entry` | Lançamento em uma conta. Nunca existe sozinho |
| `Transaction` | Conjunto atômico de `Entry` cuja soma é zero separadamente para cada commodity presente |
| `Bot` | Investidor fictício da leaderboard. Exógeno |
| `Npc` | Bot com o qual o jogador pode interagir em missão |
| `Quest` | Missão. Principal ou secundária |
| `MacroEvent` | Evento de mundo com janela e curva de impacto |
| `WorldSnapshot` | Projeção somente-leitura do estado em um tick |

### Ativos da fase inicial

Nomes fictícios travados. Arquétipos definem os parâmetros do gerador.

| Ticker | Nome | Arquétipo | Volatilidade base |
|---|---|---|---|
| `ORB` | Orbis | blue chip | baixa |
| `NEXA` | Nexa Chain | camada 1 estabelecida | média |
| `HELX` | Helix Protocol | infraestrutura | média-alta |
| `VOLT` | Voltaic | alt de ciclo | alta |
| `ZARA` | Zaraya | alt especulativa | alta |
| `PEPU` | Pepucoin | meme | extrema |
| `USDX` | USDX | stablecoin com risco de perda de paridade | mínima, com cauda |

`USDX` mantém paridade próxima de 100 centavos por padrão e sofre perda de paridade apenas como evento macro raro. Isso é intencional: gera um risco de cauda que testa se o time modela ativos com regime bimodal.

---

## 5. Motor de mundo

### 5.1 Construção do preço

O preço é construído em espaço logarítmico, em ponto fixo, por soma de camadas. Todas as camadas são posicionais.

```
logPrice(asset, tick) =
    logPrice0(asset)
  + trendLayer(asset, tick)
  + marketFactor(tick) * beta(asset)
  + idiosyncraticNoise(asset, tick) * regimeAmplitude(tick) * volBase(asset)
  + macroImpact(asset, tick)
  + pegAnchor(asset, tick)
```

- `trendLayer` e `idiosyncraticNoise` são ruído fractal por oitavas. Cada oitava tem período fixo, amostra `rand(seed, namespace, asset, octave, floor(tick / period))` nos vértices do bloco e interpola. Amplitude decresce por oitava. O resultado é uma série que se comporta como caminhada aleatória mas é consultável em O(1) em qualquer tick, sem estado.
- `marketFactor` é a camada comum a todos os ativos, o que produz correlação realista entre eles. `beta` por ativo é derivado do arquétipo.
- `regimeAmplitude` é uma camada de frequência muito baixa que modula a volatilidade. Produz períodos de calma e períodos de turbulência.
- `pegAnchor` aplica-se somente a stablecoins e força retorno à paridade fora de eventos.
- Número de oitavas, períodos e amplitudes são **DEFINIR**, com um requisito: os parâmetros ficam em um arquivo de configuração versionado, e mudar um parâmetro precisa invalidar o hash de compatibilidade da spec.

### 5.2 Eventos macro

Eventos nascem em janelas de tamanho fixo `W` ticks e têm duração máxima `Dmax`.

Para saber quais eventos estão ativos no tick `t`, basta inspecionar as janelas de índice `floor((t - Dmax) / W)` até `floor(t / W)`. Isso mantém a consulta em O(1) amortizado, sem varredura.

Cada janela sorteia zero ou mais eventos por `rand(seed, "macro.schedule", windowIndex)`. Cada evento tem:

```
{ startTick, durationTicks, kind, affectedAssets, magnitude, curve }
```

`curve` define a forma do impacto ao longo da duração. Arquétipos mínimos: choque instantâneo com reversão parcial, rampa sustentada, capitulação em três fases.

Categorias mínimas de `kind`: regulatório, falência de exchange, adoção institucional, falha técnica de protocolo, perda de paridade de stablecoin, euforia de varejo, evento macroeconômico global.

O evento é resolvido pelo motor antes de qualquer texto existir. O texto é gerado depois, a partir do evento resolvido.

### 5.3 Bots e leaderboard

100 bots. Cada um tem política derivada de `rand(seed, "bot.policy", botId)`: arquétipo de estratégia, tolerância a risco, uso de alavancagem, frequência de operação, capital inicial, e um viés de habilidade que determina se ele tende a acertar ou errar timing.

A curva de patrimônio de cada bot é função de `(seed, botId, tick)` e precisa ser consultável sem simular tick por tick. Aqui existe uma tensão que precisa ser resolvida por construção, não por otimização: um bot que opera alavancado pode ser liquidado, e liquidação depende do caminho do preço, o que elimina qualquer fórmula fechada para o patrimônio dele.

A resolução travada é reduzir a resolução temporal da simulação de bots, não buscar fórmula fechada:

- Bots decidem apenas em ticks múltiplos de `BOT_DECISION_PERIOD`. O valor é **DEFINIR**, com piso de 1440 ticks, equivalente a um dia de jogo
- Liquidação de bot é avaliada na mesma grade, usando o preço extremo do intervalo, calculado por amostragem determinística de um número fixo de pontos dentro do intervalo
- O patrimônio de um bot em um tick arbitrário é o patrimônio do último ponto de grade, marcado a mercado no tick consultado
- Com 100 bots, um dia de grade e dez anos de jogo, a simulação completa é da ordem de 365 mil avaliações, o que cabe folgado em pré-computação incremental com cache por bloco

Trade-off aceito e registrado: bots não fazem operação intradiária e não são liquidados por pavio curto. O jogador é. Essa assimetria é aceitável e até desejável, porque o jogador tem informação e reflexo que o bot não simula.

Restrição de performance travada: consultar a leaderboard no tick 5.000.000 não pode exigir iterar a grade inteira em tempo de interação. O cache por bloco é obrigatório e precisa ser validado contra a simulação completa da grade.

A leaderboard é ordenada por patrimônio. O jogador entra nela na posição que seu patrimônio determinar. Bots quebram, saem da lista, e novos bots entram. Isso é parte da simulação e é determinístico.

Requisito de produto: a leaderboard precisa ser interessante de ler. Bots têm nome, avatar procedural, arquétipo público visível, histórico de operações notórias, e uma reputação. Um bot que perdeu 90% em uma liquidação famosa precisa ter isso registrado e exibível.

### 5.4 Dicas de NPC

Uma dica tem um valor de verdade decidido pelo motor:

```
isTruthful = rand(seed, "npc.tip.truth", npcId, questId, attempt) < truthThreshold(npcId, trustLevel)
```

Se a dica é verdadeira, o conteúdo precisa apontar corretamente para o que o mundo de fato fará. Se é falsa, precisa apontar para algo que o mundo não fará.

O jogador não sabe qual é qual. Ele aprende, ao longo da carreira, em quem confiar. Essa é a mecânica central das missões secundárias.

Invariante crítica: uma dica marcada como falsa nunca pode coincidir com o movimento real do mercado. Isso exige que o gerador de dica consulte o mundo futuro antes de compor o conteúdo.

---

## 6. Ledger

Dupla entrada obrigatória. Nenhuma mutação de saldo acontece fora de uma `Transaction`.

O ledger é multi-commodity. Não existe soma matematicamente válida entre um valor em BRL e uma quantidade de ORB, e uma transação de compra spot envolve as duas commodities ao mesmo tempo. Portanto o balanceamento é **por commodity**, nunca agregado:

```
forEach commodity in transaction: balance(transaction, commodity) == 0
```

Uma compra de 0,03 ORB por R$ 100,00 gera quatro lançamentos e fecha duas commodities separadamente: BRL sai de `player:cash:BRL` e entra em `world:counterparty_cash`; ORB sai de `world:asset_supply:ORB` e entra em `player:spot:ORB`.

Cada `Entry` declara explicitamente sua commodity. Um `Entry` sem commodity declarada é erro de tipo, não erro de execução.

Contas mínimas:

```
world:issuance
world:counterparty_cash
world:asset_supply:<ASSET>
world:rounding_residue:<COMMODITY>
world:insurance_fund
player:cash:BRL
player:spot:<ASSET>
player:margin:<INSTRUMENT>
venue:fees
venue:funding
venue:realized_pnl
venue:liquidation_penalty
```

`world:counterparty_cash` é a contrapartida de caixa de toda negociação spot. `world:insurance_fund` absorve o excedente quando uma liquidação levaria o caixa do jogador a valor negativo. `world:rounding_residue:<COMMODITY>` existe uma vez por commodity, porque resíduo de arredondamento de quantidade de ativo e resíduo de centavo são grandezas distintas e não se compensam.

Toda `Transaction` carrega: `tick`, `sequence`, `kind`, `causationId`. `causationId` referencia a ação do jogador ou o evento de sistema que a originou. Nenhuma transação órfã.

Lançamentos são imutáveis. Correção só por transação de compensação.

---

## 7. Execução e ordem canônica do tick

Tipos de ordem por fase: mercado na FASE-1; limite, stop-loss e take-profit na FASE-2; stop móvel e OCO na FASE-3.

Taxas: maker e taker distintas, definidas em `Rate`. Taxa incide sobre nocional e é lançada em `venue:fees`.

Deslizamento de execução é determinístico, função do tamanho da ordem contra a liquidez do ativo no bloco corrente, e é distinto do impacto de mercado do ADR-007. Deslizamento afeta o preço daquela execução. Impacto afeta o preço efetivo dos ticks seguintes.

### Ordem canônica de processamento de um tick

Esta sequência é **TRAVADA**. Ela precisa estar implementada em um único ponto do código, ser legível como uma lista de passos, e ter teste que verifica a ordem.

1. Resolver `worldPrice` de todos os ativos no tick
2. Aplicar decaimento de `playerImpact` e calcular `effectivePrice`
3. Se o tick é fronteira de financiamento, aplicar taxa de financiamento sobre posições perpétuas abertas
4. Avaliar liquidações sobre as posições abertas com o preço já atualizado
5. Disparar ordens condicionais pendentes que cruzaram, na ordem de submissão
6. Executar ordens submetidas pelo jogador neste tick, na ordem de `sequence`
7. Avançar políticas de bots, se aplicável ao tick
8. Recalcular patrimônio, margem disponível e projeções
9. Avaliar condições de missão e conquista
10. Emitir hash de estado do tick

Passos 3 e 4 nessa ordem, não o contrário: financiamento pode ser exatamente o que leva a posição à liquidação, e inverter isso é um bug clássico de exchange real.

Financiamento é aplicado a cada 480 ticks, com fronteiras em ticks múltiplos de 480 contados desde zero. Aplicar duas vezes na mesma fronteira, ou pular uma fronteira durante avanço acelerado, são as duas falhas mais prováveis deste subsistema.

---

## 8. Derivativos, margem e liquidação

Contratos perpétuos com margem isolada por posição na FASE-3. Margem cruzada na FASE-7, e não antes.

Alavancagem de 1x a 50x, por faixas. Cada faixa tem uma taxa de margem de manutenção própria, crescente com a alavancagem.

Definições travadas:

```
initialMargin      = notional / leverage
maintenanceMargin  = notional * maintenanceRate(leverageTier)
positionEquity     = allocatedMargin + unrealizedPnl
liquidationTrigger = positionEquity < maintenanceMargin
```

O preço de liquidação exibido ao jogador precisa ser derivado dessas definições, não estimado por aproximação, e precisa coincidir com o preço em que a liquidação de fato ocorre.

Regras travadas:

- Liquidação nunca deixa o saldo de caixa do jogador negativo. Existe fundo de proteção do mundo que absorve o excedente, com lançamento próprio no ledger
- Liquidação cobra penalidade, lançada em `venue:liquidation_penalty`
- Liquidação parcial reduz a posição até o mínimo necessário para restaurar a margem, e é preferível à liquidação total quando a posição permitir
- Financiamento negativo pode creditar o jogador. O sinal precisa estar correto nos dois sentidos

Este é o subsistema com maior densidade de defeitos do projeto. Exchanges reais erram aqui. Testes de propriedade são obrigatórios, não opcionais.

---

## 9. Progressão

### Campanha

Capítulos sequenciais com metas de patrimônio, sobrevivência e competência. Uma meta de campanha nunca depende de um número aleatório não indexado.

Progressão de dificuldade: capítulo 1 é somente spot; alavancagem é desbloqueada por capítulo, não por escolha livre no início.

### Missões secundárias

Máquina de estados explícita: `LOCKED`, `AVAILABLE`, `ACTIVE`, `COMPLETED`, `FAILED`, `EXPIRED`. Transições declaradas em tabela, não espalhadas em condicionais.

Categorias mínimas:

- Cumprir uma meta de retorno em uma janela de ticks
- Operar sob restrição: sem alavancagem, apenas um ativo, número máximo de operações
- Missão de confiança: agir ou não agir sobre a dica de um NPC, e o resultado ajusta a confiança daquele NPC
- Missão de sobrevivência: atravessar um evento macro sem ser liquidado
- Missão de reputação: alcançar uma posição na leaderboard e sustentá-la por N ticks

### Conquistas

Verificáveis a partir do ledger e do log de ações, sem estado auxiliar mutável. Uma conquista é uma consulta sobre o histórico, não uma flag que alguém precisa lembrar de ligar.

---

## 10. Controle de tempo

Velocidades: pausado, 1x, 10x, 100x, 1000x, e avanço direto até um tick de destino.

Restrições travadas:

- O resultado do avanço acelerado é idêntico ao resultado da simulação em 1x. Sem exceção, sem tolerância
- Avanço direto não pode pular avaliação de ordens condicionais, fronteiras de financiamento ou gatilhos de liquidação
- Existe caminho rápido: se não há posição aberta, ordem pendente nem missão sensível a tempo, o avanço pode saltar blocos. A equivalência com o caminho completo precisa ser provada por teste
- A interface nunca bloqueia por mais de 100ms durante avanço. Simulação fora da thread de renderização

Esta seção parece simples e é o principal gerador de falha retroativa do projeto. Qualquer acoplamento entre tempo de jogo e relógio do sistema introduzido nas fases iniciais se manifesta aqui, e não é corrigível localmente.

---

## 11. Camada de narrativa

Interface travada:

```
NarrativeRequest {
  kind: "macro_news" | "npc_tip" | "npc_dialogue" | "post_mortem" | "leaderboard_note"
  context: object
  allowedNumerics: string[]
  locale: "pt-BR"
}

NarrativeResponse {
  text: string
  source: "template" | "model"
}
```

`context` já contém todos os fatos resolvidos pelo motor. `allowedNumerics` é a whitelist de numerais que podem aparecer no texto.

Fluxo: gerar por template sempre; se a camada de modelo estiver ativa, tentar enriquecer; validar; usar o resultado do modelo apenas se passar na validação; caso contrário manter o template.

Nenhuma chamada de rede no caminho determinístico. Nenhuma chamada de rede nos testes.

---

## 12. Invariantes

Cada invariante exige teste automatizado permanente no gate de CI.

**INV-01** Replay puro do save produz estado idêntico à sessão ao vivo, comparado por `StateHash` em todo tick.

**INV-02** Consultar `price(asset, t)` diretamente é igual a chegar em `t` avançando tick por tick, para qualquer `t` e qualquer asset.

**INV-03** Ações do jogador não alteram nenhum valor do mundo base. Duas sessões na mesma seed com logs de ação diferentes têm séries de `worldPrice` idênticas.

**INV-04** Em toda `Transaction`, para cada commodity presente, a soma dos `Entry` daquela commodity é exatamente zero. Não existe soma agregada entre commodities distintas.

**INV-05** Para BRL, a soma dos saldos de todas as contas é exatamente zero em todo tick.

**INV-06** Para cada ativo, a soma das quantidades em todas as contas é exatamente zero em todo tick.

**INV-07** Nenhuma operação de arredondamento perde valor. O resíduo acumulado em `world:rounding_residue:<COMMODITY>` explica a diferença exata entre a soma dos truncamentos e o valor nominal, por commodity.

**INV-08** O saldo de `player:cash:BRL` nunca é negativo após liquidação.

**INV-09** O preço de liquidação exibido coincide com o preço em que a liquidação ocorre, com tolerância zero.

**INV-10** A taxa de financiamento é aplicada exatamente uma vez por fronteira e por posição, em qualquer velocidade de tempo, incluindo avanço direto que atravesse múltiplas fronteiras.

**INV-11** Avançar de `t0` a `t1` em passos de 1 tick, em passos de 100 ticks e em salto direto produz o mesmo `StateHash` final.

**INV-12** Nenhum identificador gerado no domínio depende de fonte de entropia externa. Todos são deriváveis de `(seed, tick, sequence)`.

**INV-13** Toda iteração sobre coleção que afete resultado tem ordem total explícita. Nenhuma dependência de ordem de inserção de estrutura de dados.

**INV-14** Nenhum numeral presente em texto narrativo está ausente do contexto estruturado que o originou.

**INV-15** Uma dica de NPC marcada como falsa nunca coincide com o movimento real do mercado no horizonte que ela alega.

**INV-16** O jogo é jogável de ponta a ponta com a camada de modelo de linguagem desligada.

**INV-17** O `checkpoint` de save, quando presente, produz o mesmo estado que o replay puro até aquele tick.

**INV-18** Nenhuma transição de missão ocorre fora da tabela de transições declarada.

**INV-19** O mesmo save produz o mesmo estado final em Windows e em Linux, e no worker de simulação e no CLI de replay, sob a versão fixada do Electron.

**INV-20** O patrimônio de qualquer bot obtido pelo cache por bloco coincide com a simulação completa da grade de decisão daquele bot.

**INV-21** O save carrega `finalTick`, e nenhuma ação do log tem `tick` maior que ele. O par `(tick, sequence)` é único no log.

**INV-22** Dois estados logicamente iguais produzem bytes canônicos iguais, e dois estados logicamente diferentes produzem bytes canônicos diferentes. Nenhum texto narrativo influencia o `StateHash`. `finalTick` não participa do `StateHash`: dois saves com a mesma seed e as mesmas ações até `t` têm `StateHash` idêntico em `t`, independentemente de suas durações totais.

**INV-23** Nenhum valor de inteiro seguro excede o limite de 2^53 em nenhum ponto da execução de um replay de dez anos de jogo.

**INV-24** Replay de um save sob o `rulesetVersion` original produz sempre o mesmo `StateHash` final. Migração do mesmo save produz sempre um `StateHash` final novo e estável, com `SaveHash` distinto, e a diferença entre os dois estados é integralmente explicada pelas entradas de ledger geradas pela migração.

**INV-25** O impacto de mercado de uma execução é exatamente zero após `IMPACT_WINDOW` ticks, e `effectivePrice` em qualquer tick não depende de ações anteriores a essa janela.

**INV-26** O grafo de dependências da seção 14.5 é respeitado integralmente, inclusive transitivamente. `world` e `domain` não se importam mutuamente, `narrative` não importa `domain` nem `world`, `ui` não importa `application`, e nenhum pacote puro importa `electron`, `node:fs`, `node:path`, driver de banco ou cliente de rede.

**INV-27** Nenhuma tabela do banco representa posição, ordem, lançamento de ledger ou saldo. O estado do jogo é reproduzível a partir do arquivo de save sem o banco presente.

**INV-28** Todo port com mais de uma implementação tem os mesmos testes de contrato passando em todas elas, sem exceção declarada.

**INV-29** A configuração da janela do Electron tem `contextIsolation` ativo, `nodeIntegration` desligado e `sandbox` ativo, em todos os modos de execução incluindo desenvolvimento. Preload expõe apenas canais da allowlist.

**INV-30** Nenhum `switch` ou cadeia de `if` sobre tipo de ativo, instrumento, ordem, evento macro ou missão existe fora da tabela de registro correspondente.

---

## 13. Proibições verificáveis por lint

Estas regras são impostas por lint bloqueante. Não são convenção de estilo.

O escopo é definido por negação padrão, não por enumeração. Todo pacote sob `packages/` é considerado puro e sujeito às proibições abaixo, exceto os que constarem de uma lista explícita de exceções em `lint.impure-packages`. A lista contém `adapters` e `ui`, e nada mais. Enumerar os pacotes puros um a um garante que o próximo pacote criado nasça fora da regra por esquecimento, e isso já aconteceu uma vez nesta spec com `world`.

`apps/` e `tools/` estão fora de `packages/` e são impuros por natureza. Eles compõem, injetam e falam com o sistema operacional. Não precisam constar da allowlist, mas continuam sujeitos à regra de dependência da seção 14.5.

Adicionar um pacote à lista de exceções exige ADR com justificativa. Nenhum pacote que contribua para o `StateHash` pode ser adicionado a ela.

Proibido em todo pacote puro, incluindo `core`, `world`, `domain`, `application` e `narrative`:

- `Math.random`
- `Date`, `Date.now`, `performance.now`, `setTimeout`, `setInterval`
- `crypto.randomUUID`, qualquer fonte de entropia
- `Math.sin`, `Math.cos`, `Math.exp`, `Math.log`, `Math.pow`, `Math.sqrt`
- Literais de ponto flutuante e o tipo `number` para valores econômicos
- `Array.prototype.sort` sem comparador total explícito
- Iteração sobre `Object.keys`, `Set` ou `Map` sem ordenação explícita quando o resultado afeta estado
- `toLocaleString`, `Intl`, qualquer formatação sensível a locale
- `fetch`, qualquer entrada e saída
- `electron`, `node:fs`, `node:path`, `node:os`, `node:child_process`, driver de banco
- `JSON.stringify` sobre qualquer estrutura que contenha valor econômico
- `console` de qualquer tipo
- Comentários. O código precisa se explicar pela nomeação

Importar de camada externa para dentro é proibido. `core` não conhece `domain`; `domain` não conhece `application`; nenhum deles conhece `ui`.

---

## 14. Stack, arquitetura e empacotamento

### 14.1 Stack travada

| Camada | Escolha |
|---|---|
| Distribuição | Electron, aplicação desktop com instalador |
| Linguagem | TypeScript em modo estrito. Sem `any`, sem asserção de tipo sem ADR, `noUncheckedIndexedAccess` ativo |
| Interface | React |
| Gráfico | `lightweight-charts`. Proibido substituir ou reescrever |
| Persistência canônica | Arquivo no sistema de arquivos local |
| Cache e metadados | SQLite, com escopo restrito conforme 14.3 |
| Empacotamento | `electron-builder` |
| Repositório | Monorepo |

TypeScript não é negociável e o motivo é mecânico, não estilístico. As decisões travadas em ADR-003 e ADR-004 dependem de tipos nominais para existir: sem eles, nada impede somar um `Tick` a um `Money`, passar um `bigint` de centavos onde se espera `Quantity`, ou dividir sem declarar modo de arredondamento. O artefato distribuído é JavaScript. O código-fonte é TypeScript, e o compilador é parte do mecanismo de imposição da spec, não conveniência de escrita.

Vantagem colateral de Electron que precisa ser explorada: main e renderer compartilham o mesmo V8 embutido na versão do Electron. Isso elimina a divergência entre runtimes que INV-19 existia para pegar. A versão do Electron é fixada em arquivo versionado e só muda por ADR, porque trocar Electron troca V8.

### 14.2 Topologia de processos

Travado:

- A simulação roda fora da thread de renderização, em worker dedicado. Renderer nunca simula
- Renderer é somente apresentação. Não conhece domínio, não muta estado, consome projeção somente-leitura
- Main process é dono do sistema de arquivos, do banco e do ciclo de vida da janela
- Comunicação por mensagem, com contrato tipado e versionado

Segurança de Electron, travada e não negociável:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true` no renderer
- Preload expõe superfície mínima por `contextBridge`, com allowlist de canais. Sem canal genérico do tipo `invoke(channel, args)`
- Content Security Policy restritiva. Sem `unsafe-eval`, sem carregamento remoto
- Nenhum `webSecurity: false`, nenhum `allowRunningInsecureContent`, em nenhuma configuração, inclusive desenvolvimento
- Sem auto-update. Fora de escopo

Serialização na fronteira de processo usa structured clone, que preserva `bigint`. `JSON.stringify` é proibido em qualquer fronteira que transporte valor econômico, porque descarta `bigint` silenciosamente. O `CanonicalEncoder` do ADR-009 serve para hash e save. Não é o transporte de mensagem e não deve ser reaproveitado como tal.

### 14.3 Persistência

O save canônico é arquivo, não registro de banco. Isso decorre do ADR-006: `masterSeed` mais log de ações mais `finalTick` é pequeno, sequencial e naturalmente um documento. Uma partida com dez mil operações são poucos megabytes.

Escopo travado do SQLite:

Permitido: metadados de partidas, perfil e meta-progressão entre partidas, índice de saves, blocos pré-computados de bots como blob opaco, checkpoints como blob opaco, registro de conquistas.

Proibido: representar estado de jogo em schema relacional. Nenhuma tabela de posições, ordens, lançamentos de ledger ou saldos. O banco não é fonte da verdade de nada que o replay produz.

O motivo é que essa fronteira desmorona por conveniência, não por decisão. Basta uma consulta que seria mais fácil em SQL para alguém normalizar o ledger em tabelas, e a partir daí existem duas fontes da verdade e o ADR-006 morreu sem que ninguém tenha decidido matá-lo.

Nota de custo que precisa entrar no ADR de escolha do driver: `better-sqlite3` é módulo nativo e exige recompilação para o ABI do Electron, o que significa prebuilds por plataforma e uma etapa a mais no CI multiplataforma. Se a única necessidade real for blob indexado, um par de arquivo mais índice resolve sem módulo nativo. Decidir com base na necessidade medida na FASE-4, não antecipadamente.

### 14.4 Estrutura

```
packages/
  core/          aritmética inteira, hash, rng posicional, ponto fixo, encoder canônico
  world/         gerador de preço, eventos macro, liquidez, bots
  domain/        ledger, ordens, posições, margem, liquidação, missões
  application/   casos de uso, ports, controle de tempo, replay
  narrative/     templates, contrato de modelo, validador
  contracts/     tipos de mensagem entre processos e DTOs de projeção
  adapters/      implementações de ports: arquivo, banco, modelo de linguagem
  ui/            React, lightweight-charts, telas
apps/
  desktop/
    main/              janela, ciclo de vida, IPC, dono do filesystem
    preload/           contextBridge com allowlist
    renderer/          composição da UI
    simulation-worker/ hospeda application e domain
tools/
  replay/        CLI de replay e comparação de hash
  bench/         calibração e orçamento de performance
  package/       instaladores e build reproduzível
docs/
  decisions/     ADRs numerados
```

`core`, `world`, `domain`, `application`, `narrative` e `contracts` são puros. `adapters` e `ui` são impuros e constam da allowlist do lint conforme seção 13. `apps` e `tools` estão fora de `packages/` e são impuros por natureza.

### 14.5 Arquitetura verificável

SOLID, Clean Code e Clean Architecture são obrigatórios, e ficam expressos como regras checáveis. Princípio sem verificação automatizada é decoração, e nesta spec não conta como cumprido.

**Regra de dependência.** O grafo completo, travado:

```
apps          -> adapters, ui, contracts
adapters      -> application, contracts
ui            -> contracts
application   -> domain, world, narrative, contracts
domain        -> core
world         -> core
narrative     -> core
contracts     -> core
core          -> nada
```

Nenhuma seta na direção oposta, nenhuma seta ausente do grafo acima. Imposto por lint de fronteira, bloqueante, e verificado também transitivamente.

Proibições cruzadas explícitas, porque são as que a intuição viola primeiro:

- `world` não conhece `domain`. `domain` não conhece `world`. Nenhum dos dois importa o outro, em nenhuma circunstância
- `narrative` não conhece `domain` nem `world`. Recebe contexto já resolvido, tipado em `core`
- `ui` não conhece `application`, `domain` nem `world`. A fronteira entre renderer e worker é fronteira de processo, e importar `application` no renderer significa que a simulação subiu junto com a interface
- `core` não conhece nada. Se algo em `core` precisa de outra camada, o algo está na camada errada

**Composição de `world` com `domain`.** `world` e `domain` são pares que não se conhecem, e `application` é quem os compõe. Isso resolve a ordem canônica do tick da seção 7 sem criar acoplamento: `application` resolve o preço em `world`, entrega ao `domain` como dado, e o `domain` decide funding, liquidação e execução sem saber de onde o preço veio.

Consequência travada para `effectivePrice`: o cálculo de impacto de mercado vive em `world`, não em `domain`, e recebe o fluxo recente de execuções como dado de entrada tipado em `core`, na forma de uma lista de `{ tick, assetId, signedQuantity }`. `world` continua ignorante de posições, ordens e ledger. Se alguém for tentado a passar uma entidade de `domain` para `world`, a resposta é extrair o dado primitivo, não relaxar a regra.

**Contrato de fronteira de processo.** `packages/contracts` contém apenas os tipos de mensagem entre main, preload, renderer e worker, mais os DTOs de projeção somente-leitura consumidos pela interface. Sem lógica, sem dependência além de `core`. Ele existe porque `ui` e `application` rodam em processos diferentes e precisam de um contrato comum sem que um importe o outro.

**Inversão de dependência.** Toda dependência externa ao domínio atravessa um port declarado em `application`, implementado em `adapters`, e injetado em `apps/desktop`. Nenhum pacote puro importa `electron`, `node:fs`, `node:path`, driver de banco ou cliente de rede.

**Substituição de Liskov, na forma auditável.** Todo port com mais de uma implementação tem uma suíte de teste de contrato única, e toda implementação daquele port executa a suíte inteira. Implementação que precisa de exceção na suíte é violação, não caso especial.

**Segregação de interface.** Ports são definidos pelo consumidor e nomeados pelo que ele precisa. Proibido port genérico agregando operações não relacionadas, do tipo `IRepository` ou `IStorage`.

**Aberto para extensão.** Proibido `switch` ou cadeia de `if` sobre tipo de ativo, tipo de instrumento, tipo de ordem, categoria de evento macro ou categoria de missão. Esses tipos vivem em tabela de registro, e adicionar um caso novo significa adicionar uma entrada, não editar um ramo existente. A FASE-7 é o teste dessa regra: adicionar o oitavo ativo e o segundo tipo de contrato sem tocar em código existente.

**Responsabilidade única, na forma auditável.** Cada caso de uso tem uma entrada, uma saída e um ponto de entrada público. Nenhum caso de uso chama outro caso de uso; composição acontece na camada de aplicação acima deles.

**Limite contra abstração especulativa.** Um port só existe se houver fronteira de processo, fronteira de entrada e saída, ou duas implementações reais em uso, contando o dublê de teste. Criar interface para um único uso interno é violação de Clean Code por excesso, e será rejeitado. Envolver `lightweight-charts` em camadas de abstração é proibido explicitamente.

Nomeação, tamanho de função e ausência de comentário seguem a seção 13. Um arquivo que precisa de comentário para ser entendido precisa ser renomeado ou decomposto.

### 14.6 Empacotamento e plataformas

Alvos obrigatórios: Windows e Linux, com instalador funcional produzido pelo CI.

macOS é melhor esforço. Sem notarização e sem assinatura, o que é aceito e documentado. Assinatura de código está fora de escopo em todas as plataformas.

Build reproduzível: duas execuções do empacotamento no mesmo commit produzem artefatos com o mesmo hash, com exceção de campos de data de build, que precisam ser fixados ou removidos.

Requisito de sequenciamento travado: o instalador existe na FASE-1, em forma mínima. Não no fim. Se o empacotamento multiplataforma aparecer depois, o time descobre problema de módulo nativo, de ABI e de caminho de arquivo na última semana, quando já não há tempo de corrigir arquitetura. Instalador que abre uma janela vazia na FASE-1 vale mais que instalador perfeito na FASE-7.

Backend, servidor e leaderboard compartilhada permanecem fora de escopo. A aplicação é integralmente local.

---

## 15. Fases de entrega

Cada fase tem critério de aceite objetivo. Fase não aceita bloqueia a próxima. Não existe trabalho paralelo em fase futura.

### FASE-1 — Fundação determinística

Escopo: `core` completo. Aritmética inteira, ponto fixo, hash, rng posicional. `CanonicalEncoder` conforme ADR-009. Gerador de preço com duas camadas de ruído e dois ativos. Ledger multi-commodity de dupla entrada. Ordem a mercado, compra e venda spot. Loop de tick com a ordem canônica implementada. Save com seed, log de ações e `finalTick`. CLI de replay. Baseline de performance congelado.

Aceite:
- INV-01 a INV-07, INV-12, INV-13, INV-21, INV-22, INV-23, INV-26, INV-29 verdes
- ADR-009 escrito e o encoder implementado antes de qualquer hash de estado existir
- Lint de determinismo por negação padrão, ativo e bloqueante no CI
- Lint de fronteira de dependência ativo e bloqueante
- Simulação já rodando em worker dedicado, fora da thread de renderização, com contrato de mensagem tipado
- Instalador mínimo para Windows e Linux produzido pelo CI, ainda que a aplicação faça pouco
- `tools/replay` compara duas execuções e reporta o primeiro tick divergente
- `tools/bench` com calibração e razões de referência congeladas
- Interface mínima: gráfico, saldo, botão de comprar e vender, controle de pausa e 1x

### FASE-2 — Profundidade de execução

Escopo: os sete ativos. Camadas de fator de mercado, regime de volatilidade e correlação. Ordem limite, stop-loss, take-profit. Taxa maker e taker. Deslizamento determinístico. Impacto de mercado do jogador conforme ADR-007. Livro de ordens simplificado exibível.

Aceite:
- Teste de propriedade: mil sequências aleatórias de ordens preservam INV-05 e INV-06
- Ordem limite dispara no mesmo tick em 1x e em avanço acelerado
- INV-03 verde com logs de ação divergentes na mesma seed

### FASE-3 — Alavancagem

Escopo: contratos perpétuos, margem isolada, faixas de alavancagem, financiamento, liquidação total e parcial, proteção contra saldo negativo, preço de liquidação exibido.

Aceite:
- INV-08, INV-09, INV-10 verdes
- Teste de propriedade sobre séries adversariais de preço: nenhuma posição sobrevive a um preço que cruza seu gatilho, e nenhuma é liquidada antes disso
- Financiamento correto nos dois sinais
- Cenário de reprodução documentado para cada defeito encontrado, com save canônico completo, tick de manifestação e invariante violada quando aplicável

### FASE-4 — Mundo vivo

Escopo: eventos macro com as sete categorias e três curvas. Os 100 bots com políticas e consulta de patrimônio em O(1). Leaderboard navegável com perfil, histórico e reputação. Perda de paridade de `USDX` como evento raro.

Aceite:
- INV-20 verde
- Consultar a leaderboard em qualquer tick responde dentro do orçamento de performance
- Evento macro é reproduzível pela seed e visível no gráfico

### FASE-5 — Carreira

Escopo: campanha com capítulos, missões secundárias com as cinco categorias, máquina de estados de missão, conquistas, sistema de confiança de NPC, dicas verdadeiras e falsas.

Aceite:
- INV-15, INV-18 verdes
- Uma partida completa do capítulo 1 ao último é jogável sem travar
- Dica falsa nunca coincide com o mercado, verificado por varredura sobre 100 seeds

### FASE-6 — Controle de tempo

Escopo: todas as velocidades, avanço direto até tick de destino, caminho rápido com prova de equivalência, progressão offline, simulação fora da thread de renderização.

Aceite:
- INV-11 verde para pelo menos 50 pares de ticks aleatórios
- Um ano de tempo de jogo replicado dentro do orçamento de performance
- Nenhum bloqueio de interface acima de 100ms medido

### FASE-7 — Features retroativas

Escopo desenhado para quebrar decisões passadas. Cada item é obrigatório.

- Adicionar um oitavo ativo em uma partida já em andamento, com histórico e posições existentes, sem invalidar saves
- Adicionar imposto sobre lucro realizado com apuração mensal, sob novo `rulesetVersion`, incidindo retroativamente sobre operações já presentes no histórico do save migrado
- Adicionar margem cruzada convivendo com margem isolada
- Adicionar um segundo tipo de contrato, à escolha do time, com ADR
- Exercitar o versionamento de ADR-010 de ponta a ponta, com migração de save e relatório de diferença

Aceite:
- Nenhuma invariante regride
- Saves da FASE-6 continuam carregáveis sob o `rulesetVersion` original e produzem exatamente o mesmo hash de antes
- O mesmo save, migrado para o novo `rulesetVersion`, produz um hash novo estável e reproduzível, e a diferença de saldo é explicada linha por linha pelas entradas de ledger da migração
- INV-24 verde
- Relatório de quantos testes existentes quebraram por item, com causa

Nota de projeto: a regra não é que o estado não possa mudar. Imposto retroativo muda o saldo por definição, e exigir o contrário seria exigir que a regra não valesse. A regra é que cada trilha seja determinística e que a diferença entre elas seja auditável.

---

## 16. Definition of Done por feature

Uma feature está pronta quando todos os itens abaixo são verdadeiros. Parcial não conta.

1. Critério de aceite escrito antes do código, em formato verificável
2. Testes de unidade sobre a lógica nova
3. Teste de propriedade quando a feature tem invariante associada
4. Nenhuma invariante existente regrediu
5. Lint de determinismo verde
6. Replay de uma partida de referência continua produzindo o mesmo `StateHash`. Mudança esperada precisa estar justificada em ADR e acompanhada do bump da versão semanticamente responsável: `rulesetVersion` para mudança de regra econômica, `encodingVersion` para mudança de codificação canônica, `specVersion` quando esta especificação normativa mudar
7. ADR registrado para qualquer item marcado **DEFINIR** que a feature resolveu
8. Nenhum arquivo tocado fora do escopo da feature
9. Orçamento de performance respeitado
10. Interface em português, código em inglês, sem emoji, sem comentário, sem `console`

---

## 17. Gate de CI

Bloqueante. Nenhuma exceção, nenhum `skip`, nenhuma marcação de teste instável.

1. Compilação em modo estrito
2. Lint de determinismo e lint de fronteira de dependência
3. Testes de unidade e integração
4. Testes de propriedade com número fixo de casos e seed de teste registrada
5. Replay de três partidas de referência com comparação de `StateHash` por tick
6. Matriz de plataformas: Windows e Linux, na versão fixada do Electron, comparando worker de simulação contra CLI de replay
7. Build de instalador em ambas as plataformas, com verificação de reprodutibilidade de artefato
8. Auditoria de configuração de segurança do Electron conforme INV-29
9. Orçamento de performance conforme protocolo da seção 18
10. Verificação de fronteira de dependência entre pacotes e da allowlist de pacotes impuros
11. Verificação de que nenhum teste faz chamada de rede

Teste instável é defeito de prioridade máxima. A resposta correta a um teste instável é encontrar a fonte de não-determinismo, nunca aumentar tolerância nem repetir a execução.

---

## 18. Orçamento de performance

| Operação | Limite |
|---|---|
| `price(asset, tick)` | 2µs |
| Avanço de 1 tick com 10 posições abertas | 50µs |
| Replay de 1 ano de jogo, 525.600 ticks | 5s |
| Consulta de leaderboard em qualquer tick | 30ms |
| Avanço direto de 30 dias de jogo | 500ms |
| Bloqueio de thread de renderização | 100ms |

Os números acima são metas em hardware de referência. Sozinhos, não são critério de aceite: sem runtime fixo, aquecimento, tamanho de amostra e percentil declarados, dois revisores podem discordar de boa-fé sobre se a medição passou.

### Protocolo de medição

Travado:

- Runtime fixo, versão declarada em arquivo versionado. Uma linha do CI roda na versão fixa e é a única que decide aceite
- Aquecimento de 3 execuções descartadas antes da medição
- Amostra mínima de 20 execuções por linha
- Critério é o percentil 95, não a média nem a melhor execução
- Medição em processo dedicado, sem outra etapa do CI em paralelo
- Cada execução reporta amostra completa, não apenas o agregado

### Baseline relativo

Valores absolutos em CI compartilhado são ruído. A cada execução, `tools/bench` roda primeiro um micro-benchmark de calibração de custo conhecido e fixo, na mesma máquina e no mesmo processo. Todos os limites são expressos como razão contra a calibração.

Isso torna a métrica portátil entre máquinas e é o que permite comparar duas execuções separadas por semanas. As razões de referência são estabelecidas na FASE-1, congeladas em arquivo versionado, e só mudam por ADR.

Regressão acima de 20% na razão de qualquer linha bloqueia a entrega. Regressão de 10% a 20% não bloqueia, mas exige registro.

---

## 19. Protocolo de ambiguidade

Este documento tem lacunas propositais, marcadas **DEFINIR**, e lacunas não propositais.

Ao encontrar uma lacuna:

1. Registrar um ADR em `docs/decisions/` com número sequencial, contexto, opções consideradas, decisão e consequências
2. Escolher a opção que preserva o maior número de invariantes, mesmo que exija mais trabalho
3. Nunca inventar um número com efeito econômico sem registrá-lo em arquivo de configuração versionado
4. Nunca resolver ambiguidade adicionando aleatoriedade, tolerância numérica ou tratamento de exceção que engula o caso

### Contradições e bloqueios

Ao encontrar contradição entre duas seções deste documento, a contradição é um defeito da spec. Escolher em silêncio é a falha mais grave possível neste projeto. Mas parar o projeto inteiro também é falha, e esta é a regra que resolve as duas:

1. Registrar em `SPEC_BLOCKERS.md`, com identificador, seções em conflito, impacto e frentes de trabalho afetadas
2. A frente afetada é bloqueada. O projeto não é
3. É obrigatório procurar e assumir trabalho não bloqueado. Ficar ocioso aguardando resposta é falha de processo, não prudência
4. Todo bloqueio aberto é revisado a cada ciclo de trabalho, porque uma resposta pode ter chegado

### Decisão provisória

Se um bloqueio impede toda a frente crítica e não existe trabalho não bloqueado disponível, é permitido registrar uma `PROVISIONAL DECISION` em `SPEC_BLOCKERS.md` contendo: opção escolhida, opções rejeitadas, motivo da escolha, e o que muda se a decisão for revertida.

Condições travadas para decisão provisória:

- É proibida sobre qualquer decisão marcada **TRAVADA**. Decisão travada só cai por revogação explícita do dono do produto
- É proibida quando envolve inventar número com efeito econômico não registrado em configuração versionada
- O comportamento escolhido precisa estar coberto por teste que documente a escolha de forma isolada e removível
- Fica marcada como reversível e permanece no registro até resposta do dono do produto
- Se o número de decisões provisórias abertas passar de cinco, novas decisões provisórias são proibidas e o registro precisa ser destacado no topo do relatório

Ao receber um requisito que viola uma decisão **TRAVADA**, recusar o requisito e apontar a decisão.

### Lacunas conhecidas

Os itens abaixo estão marcados **DEFINIR** e são deliberados. Resolvê-los por ADR é trabalho esperado, não bloqueio:

função de hash, número de oitavas e parâmetros do gerador, imposição técnica do modo de arredondamento, `IMPACT_WINDOW`, `BOT_DECISION_PERIOD`, segundo tipo de contrato da FASE-7.

---

## 20. Aviso obrigatório no produto

A interface exibe, de forma permanente e não dispensável, que se trata de simulação com ativos inexistentes e dinheiro fictício, e que nada ali constitui recomendação de investimento.
