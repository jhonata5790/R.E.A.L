# R.E.A.L — Tabletop

O site possui quatro páginas: `index.html` para criar e acessar mesas, `mesa.html` para preparar e transmitir o tabletop, `mesa-jogador.html` para acompanhar pelo convite e `apoie.html` para apoiar voluntariamente o projeto via Pix.

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

`check` confere a sintaxe e os caminhos das páginas. `test` executa os testes de mesas, conta, convites, tabletop e doações. `build` copia somente as páginas e os recursos ativos para `outputs/site`; não envia nada à internet. Publique o conteúdo dessa pasta, não a pasta completa do projeto.

A pasta `.publish/github` é o checkout usado nas publicações anteriores. Não é a fonte de trabalho atual. Não copie o projeto inteiro para lá: use os arquivos preparados em `outputs/site`, revisando também a remoção de arquivos antigos do checkout antes da próxima publicação.

## Atalhos da mesa

Consulte a lista pelo botão `?` na barra do tabletop ou pela tecla `?`. `Espaço` inicia o acompanhamento da visão do jogador pelo mouse; outro toque fixa a posição, e `Esc` restaura a posição anterior. `Shift + Espaço` centraliza a visão na seleção.

`F` enquadra a seleção ou o mapa na câmera do mestre. Arrastar com o botão do meio ou direito move essa câmera. `R` alterna a régua, `G` alterna a grade e `Shift + G` alterna o encaixe. `H` oculta/revela os tokens selecionados; `Shift + H` alterna a interface do mestre.

`Ctrl + C/V` copia e cola tokens dentro da mesa. `Ctrl + Z` desfaz e `Ctrl + Shift + Z` refaz até 50 alterações desta visita, incluindo movimentos em grupo, rotação, tamanho, visibilidade, mapa e exclusões. O histórico compartilha as imagens entre os estados e não é armazenado na conta. No Mac, use `⌘` no lugar de `Ctrl`.

Os atalhos ficam pausados em campos de texto e janelas abertas. A opção de encaixar na grade é salva com a cena.

## Apontador dos jogadores

Durante a transmissão, o mestre abre a lista de espectadores pelo botão de pessoas e marca **Permitir apontar** ao lado do jogador. O botão **Apontar** aparece para aquela pessoa; depois de ativá-lo, um clique ou toque no mapa cria um ponto com nome e cor por três segundos. Há um intervalo de 1,2 segundo entre pedidos. Esc ou um segundo clique no botão cancela a preparação.

A autorização é individual e começa desligada em cada sessão. O mestre pode retirá-la imediatamente; sair da sala, encerrar a transmissão ou substituir o mestre em outra aba também invalida a autorização. Os pontos não alteram tokens, câmeras, cena ou histórico e não entram nos backups. O modo econômico funciona com o apontador; enquanto a imagem ainda não corresponde ao novo enquadramento, o botão aguarda sincronização.

Pedidos e mensagens usam assinaturas ECDSA por sessão. Somente a chave pública do mestre é guardada em `tabletop_rooms.pointer_authority`, sob as políticas de propriedade existentes, e oferecida pelo convite. Permissões e chaves privadas ficam na memória, sem persistência. O recurso requer HTTPS (ou localhost) e suporte a Web Crypto. A migração e a função de convite precisam estar atualizadas antes da próxima publicação do site.

## Qualidade, pausa e reconexão

A transmissão oferece qualidade por jogador, diagnóstico de recebimento, espera progressiva para reconectar, pausa do quadro enviado, zoom e tela cheia locais e apontador do mestre. A integração TURN fica pronta, mas ainda depende de configurar um serviço externo. Consulte [o guia de transmissão e configuração](docs/TRANSMISSAO.md).

## Salvamento e compatibilidade

A lista, o nome, a descrição e a capa das mesas usam a conta existente. Mapas, cenas, tokens, documentos e anotações privadas ficam neste aparelho. A sala explica essa diferença e oferece backup completo em JSON, restaurado como uma nova mesa sem sobrescrever as anteriores.

Cada mesa pode ter até 50 cenas independentes, com mapa, tokens, grade e câmeras próprios. A troca salva a cena anterior antes de carregar a próxima; desfazer/refazer fica limitado à cena atual. Salvamentos antigos são migrados automaticamente ao primeiro acesso.

A página inicial oferece busca, ordenação, última mesa aberta e opções de editar, duplicar e excluir. A sala reúne prévia, cenas, documentos, notas privadas, convite e espectadores. O tabletop agrupa ferramentas em Cena, Jogadores e Transmissão, com ações rápidas para a seleção e indicadores de régua, encaixe e câmera.

A transmissão envia apenas a área publicada e os documentos explicitamente revelados. Notas privadas não entram no convite. Duplicações e backups restaurados começam com todos os documentos privados. A sala pode iniciar uma transmissão estática; o tabletop mantém a transmissão ao vivo já existente.

Os nomes internos `campaigns`, `campaign:`, `campaign_key` e `cronicas-biblioteca-v2` continuam como formato de compatibilidade para os salvamentos anteriores. Eles não representam novas áreas de RPG no produto. Convites e URLs antigos com `?campaign=` continuam aceitos.

## Apoio voluntário

`apoie.html` oferece um Pix estático sem valor fixo, QR local e Copia e Cola. Não usa autenticação, API bancária, rastreamento ou confirmação automática de pagamento. A tela inicial tem acesso no cabeçalho, no rodapé e em uma seção de apoio.

O código mostrado no `textarea#pixCode` é a fonte do QR. Ao trocar o Pix, revise também o recebedor validado em `assets/js/portal/donations.js` e execute `scripts/generate-donation-qr.py` com Python, Pillow e ReportLab. Os testes detectam um QR desatualizado por seu hash. `scripts/verify-donation-qr.py` faz leitura independente se a dependência opcional `zxing-cpp` estiver disponível. Não envie o Pix a geradores externos e não publique `outputs/qa`.

## Vercel e busca do Google

Importe este repositório no Vercel usando o plano gratuito existente. `vercel.json` executa `npm run build` e publica somente `outputs/site`; não escolha a raiz do repositório como saída. Não são necessárias dependências de instalação nem variáveis secretas para o site estático.

O build usa o endereço de produção informado pelo Vercel (`VERCEL_PROJECT_PRODUCTION_URL`), ou `REAL_SITE_URL` quando definido explicitamente. Fora do Vercel, usa `site-config.json`. Mantenha esse arquivo atualizado com o endereço real de produção. O build gera título, descrição, endereço canônico, dados de nome do site, `robots.txt` e `sitemap.xml`. Prévias do Vercel ficam fora da busca; mesas, convites e a página com Pix possuem `noindex`. Isso não substitui autenticação ou privacidade dos dados.

No Google Search Console, adicione uma propriedade **Prefixo do URL** com o endereço público completo, escolha **Tag HTML** e coloque somente o conteúdo da tag em `googleVerification` no `site-config.json`. Publique novamente, confirme a propriedade e envie `sitemap.xml`; depois inspecione a página inicial e solicite indexação. O Google decide o prazo e a posição dos resultados; nenhum desses passos garante aparecer imediatamente para “R.E.A.L”.

Ao mudar de endereço, faça backup das mesas no site anterior. O navegador mantém mapas, tokens e documentos separadamente por domínio; eles não migram automaticamente para o Vercel. Não apague os dados do endereço antigo.

## Arquivo de RPG (preservado)

O código anterior está em `archive/rpg`, junto dos seus recursos e testes. Ele não entra na publicação atual. Nenhum dado de personagens ou homebrew foi apagado do navegador ou do banco. Para conferir esse código guardado: `npm run test:archive`.

Mudanças na função em `supabase/functions` exigem publicação própria no Supabase. O build do site não altera banco, contas ou funções.
