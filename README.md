# R.E.A.L — Tabletop

O site possui três entradas: `index.html` para criar e acessar mesas, `mesa.html` para preparar e transmitir o tabletop e `mesa-jogador.html` para acompanhar pelo convite.

## Estrutura

```
assets/
  css/                Estilos das páginas e componentes
  js/
    portal/           Tela inicial, salas e convites
    tabletop/         Canvas, tokens, transmissão e documentos
    shared/           Conta, identificação e configuração pública
supabase/             Função do convite e histórico do banco
tests/                Testes do produto atual
scripts/              Verificação e preparação da publicação
archive/
  rpg/                Fichas, regras, catálogos e testes antigos
  previews/           Capturas antigas de conferência
outputs/site/         Site pronto para publicar, gerado pelo build
```

## Conferir e preparar

Requer Node.js 22 ou superior; não é necessário instalar dependências.

```sh
npm run check
npm test
npm run build
```

`check` confere a sintaxe e os caminhos das três páginas. `test` executa os testes de mesas, conta, convites e tabletop. `build` copia somente as páginas e os recursos ativos para `outputs/site`; não envia nada à internet. Publique o conteúdo dessa pasta, não a pasta completa do projeto.

A pasta `.publish/github` é o checkout usado nas publicações anteriores. Não é a fonte de trabalho atual. Não copie o projeto inteiro para lá: use os arquivos preparados em `outputs/site`, revisando também a remoção de arquivos antigos do checkout antes da próxima publicação.

## Atalhos da mesa

Consulte a lista pelo botão `?` na barra do tabletop ou pela tecla `?`. `Espaço` inicia o acompanhamento da visão do jogador pelo mouse; outro toque fixa a posição, e `Esc` restaura a posição anterior. `Shift + Espaço` centraliza a visão na seleção.

`F` enquadra a seleção ou o mapa na câmera do mestre. Arrastar com o botão do meio ou direito move essa câmera. `R` alterna a régua, `G` alterna a grade e `Shift + G` alterna o encaixe. `H` oculta/revela os tokens selecionados; `Shift + H` alterna a interface do mestre.

`Ctrl + C/V` copia e cola tokens dentro da mesa. `Ctrl + Z` desfaz e `Ctrl + Shift + Z` refaz até 50 alterações desta visita, incluindo movimentos em grupo, rotação, tamanho, visibilidade, mapa e exclusões. O histórico compartilha as imagens entre os estados e não é armazenado na conta. No Mac, use `⌘` no lugar de `Ctrl`.

Os atalhos ficam pausados em campos de texto e janelas abertas. A opção de encaixar na grade é salva com a cena.

## Salvamento e compatibilidade

A lista, o nome, a descrição e a capa das mesas usam a conta existente. Mapas, cenas, tokens, documentos e anotações privadas ficam neste aparelho. A sala explica essa diferença e oferece backup completo em JSON, restaurado como uma nova mesa sem sobrescrever as anteriores.

Cada mesa pode ter até 50 cenas independentes, com mapa, tokens, grade e câmeras próprios. A troca salva a cena anterior antes de carregar a próxima; desfazer/refazer fica limitado à cena atual. Salvamentos antigos são migrados automaticamente ao primeiro acesso.

A página inicial oferece busca, ordenação, última mesa aberta e opções de editar, duplicar e excluir. A sala reúne prévia, cenas, documentos, notas privadas, convite e espectadores. O tabletop agrupa ferramentas em Cena, Jogadores e Transmissão, com ações rápidas para a seleção e indicadores de régua, encaixe e câmera.

A transmissão envia apenas a área publicada e os documentos explicitamente revelados. Notas privadas não entram no convite. Duplicações e backups restaurados começam com todos os documentos privados. A sala pode iniciar uma transmissão estática; o tabletop mantém a transmissão ao vivo já existente.

Os nomes internos `campaigns`, `campaign:`, `campaign_key` e `cronicas-biblioteca-v2` continuam como formato de compatibilidade para os salvamentos anteriores. Eles não representam novas áreas de RPG no produto. Convites e URLs antigos com `?campaign=` continuam aceitos.

## Arquivo de RPG

O código anterior está em `archive/rpg`, junto dos seus recursos e testes. Ele não entra na publicação atual. Nenhum dado de personagens ou homebrew foi apagado do navegador ou do banco. Para conferir esse código guardado: `npm run test:archive`.

Mudanças na função em `supabase/functions` exigem publicação própria no Supabase. O build do site não altera banco, contas ou funções.
