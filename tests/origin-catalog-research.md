# Origens do Livro de Regras

Consulta em 02/10/2026, pelo Chrome conectado, na seleção de Origem da criação do [CRIS](https://crisordemparanormal.com/novo-agente).

Foram abertos e lidos os 26 cartões do livro básico, incluindo narrativa, perícias e habilidade. As habilidades também foram confrontadas com o catálogo de Origens do CRIS. Nenhum personagem foi criado ou modificado no CRIS.

O catálogo oficial do CRIS agrega outros materiais. Cientista Forense, Dublê, Escritor, Gaudério Abutre, Ginasta, Jornalista, Professor e Revoltado ficaram fora deste recorte. Executivo pertence às 26 origens básicas.

`origin-catalog.test.js` registra o mapeamento independente das 26 origens, suas perícias e habilidades. `origins.js` contém resumos próprios, compartilhados pela criação e pela ficha pronta; não reproduz os textos integrais do livro.

## Casos particulares

- Amnésico: duas perícias escolhidas pelo mestre, sem treinamento fixo inventado. A ficha já permite registrar as duas escolhas sem repetição.
- Chef: Fortitude e Profissão (cozinheiro); a especialidade permanece informada no cartão e no catálogo.
- Operário: Fortitude e Profissão. Ferramenta de Trabalho exige uma arma simples ou tática apropriada à profissão, aprovada pelo mestre. Não aplicar seus bônus a todas as armas.
- Cultista Arrependido: poder paranormal escolhido e metade da Sanidade inicial, não da Sanidade total após todos os avanços.
- Universitário: bônus de PE e limite por turno, sem aumentar a DT de efeitos.
- Atleta: o bônus exclui Luta e Pontaria.
- Engenheiro: a redução de categoria exclui armas.

## Verificação

Testes cobrem nomes e identificadores únicos, consistência com o catálogo de habilidades, treinamento automático, habilidade derivada da origem, seleção e restauração das 26 origens, busca sem acentos e preservação da ficha durante edição.

O catálogo não implementa novas automações para todas as habilidades condicionais. Aplica o treinamento e a habilidade de origem usando a integração existente; os efeitos permanentes já suportados continuam derivados pelas mecânicas da ficha.

Conferência visual no Chrome: criação local com Policial, salvamento e retorno à edição, Percepção/Pontaria +5, Patrulha na aba Habilidades e Defesa 15 (10 + AGI 3 + origem 2). Em viewport móvel de 390 × 844, a busca `saber e poder` encontrou Acadêmico sem acentos e manteve Policial selecionado. Os campos e o cartão da origem couberam na vista móvel. Todos os 13 arquivos de testes passaram.
