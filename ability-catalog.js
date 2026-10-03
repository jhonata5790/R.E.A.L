// Consulta: catálogo oficial do C.R.I.S., em 02/10/2026.
// Textos abaixo são resumos próprios dos efeitos mecânicos, não transcrições do livro.
(function (scope) {
    "use strict";
    const book = "Ordem Paranormal";
    const source = "https://crisordemparanormal.com/";
    const categories = Object.freeze({ combatente: "Combatente", especialista: "Especialista", ocultista: "Ocultista", origens: "Origens", paranormal: "Poderes Paranormais" });
    const rows = [];
    const slug = (text) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    function group(category, subgroup, entries) {
        entries.forEach(([name, description, requirements = "", affinity = "", origin = ""]) => {
            const match = name.match(/^NEX (\d+)% - (.+)$/);
            const abilityName = match ? match[2] : name;
            const initial = { "Ataque Especial": 5, "Eclético": 5, "Perito": 5, "Engenhosidade": 40, "Escolhido pelo Outro Lado": 5 };
            const requiredNex = requirements.match(/NEX (\d+)%/);
            rows.push(Object.freeze({ id: slug(`${category}-${subgroup}-${abilityName}`), book, source,
                category, subgroup, name: abilityName, description, requirements, affinity, origin,
                minNex: match ? Number(match[1]) : requiredNex ? Number(requiredNex[1]) : initial[name] || 0,
                kind: origin ? "Habilidade de origem" : category === "paranormal" ? "Poder paranormal" : match ? "Habilidade de trilha" : initial[name] ? "Habilidade de classe" : "Poder de classe",
                repeatable: ["Transcender", "Treinamento em Perícia", "Aprender Ritual", "Resistir a <Elemento>"].includes(name) }));
        });
    }
    const martial = ["Artista Marcial", "Ataques desarmados passam a 1d6, permitem dano letal e são ágeis. O dado vira d8 em NEX 35% e d10 em 70%."];
    const transcend = ["Transcender", "Adquire um poder paranormal à escolha, sem receber a Sanidade daquele avanço de NEX. Pode ser escolhido novamente."];
    const training = ["Treinamento em Perícia", "Escolhe duas perícias para ganhar treino. Em NEX 35%, permite avançar de treinado para veterano; em 70%, de veterano para expert. É repetível."];
    group("combatente", "Poderes de Combatente", [
        ["Armamento Pesado", "Concede proficiência em armas pesadas.", "FOR 2"], martial,
        ["Ataque de Oportunidade", "Reação e 1 PE: ataque corpo a corpo contra um ser que saia voluntariamente de um espaço adjacente."],
        ["Ataque Especial", "Ao atacar, 2 PE concedem +5 em ataque ou dano. A progressão de NEX libera novos incrementos de +5 por +1 PE, distribuídos entre ambos."],
        ["Combate Defensivo", "Ao agredir, pode trocar −1d20 nos ataques por +5 na Defesa até o próximo turno.", "INT 2"],
        ["Combater com Duas Armas", "Agredir permite um ataque por arma, com −1d20 nos ataques até o próximo turno. Uma das duas armas deve ser leve.", "AGI 3; treino em Luta ou Pontaria"],
        ["Golpe Demolidor", "Ao atacar objetos ou usar quebrar, 1 PE adiciona dois dados de dano do tipo da arma.", "FOR 2; treino em Luta"],
        ["Golpe Pesado", "Armas corpo a corpo causam um dado adicional do seu próprio tipo."],
        ["Incansável", "Uma vez por cena, 2 PE concedem uma ação extra de investigação cujo teste use FOR ou AGI."],
        ["Presteza Atlética", "Facilitar investigação: 1 PE permite trocar o atributo por FOR ou AGI. Sucesso também dá +1d20 ao próximo aliado que aproveitar a ajuda."],
        ["Proteção Pesada", "Concede proficiência em proteções pesadas.", "NEX 30%"],
        ["Reflexos Defensivos", "Bônus permanente de +2 na Defesa e nos testes de resistência.", "AGI 2"],
        ["Saque Rápido", "Sacar e guardar passam a ações livres. Com contagem de munição, permite uma recarga de arma de disparo como ação livre por rodada.", "Treino em Iniciativa"],
        ["Segurar o Gatilho", "Um acerto com arma de fogo permite outro ataque no mesmo alvo. Ataques extras custam 2, 4, 6 PE etc.; a sequência termina ao errar ou atingir o limite.", "NEX 60%"],
        ["Sentido Tático", "Movimento e 2 PE: soma INT à Defesa e às resistências até acabar a cena.", "Treino em Percepção e Tática"],
        ["Tanque de Guerra", "Proteção pesada equipada concede +2 adicionais na Defesa e na resistência a dano.", "Proteção Pesada"],
        ["Tiro Certeiro", "Armas de disparo somam AGI ao dano e ignoram a penalidade por atirar em alvos em combate corpo a corpo.", "Treino em Pontaria"],
        ["Tiro de Cobertura", "Padrão e 1 PE; Pontaria contra Vontade com arma de fogo. Vitória impede movimento e impõe −5 nos ataques do alvo até seu próximo turno. Efeito de medo."], transcend, training
    ]);
    group("combatente", "Aniquilador", [
        ["NEX 10% - A Favorita", "Escolhe uma arma favorita, cuja categoria fica reduzida em I."],
        ["NEX 40% - Técnica Secreta", "A favorita reduz categoria em II. Cada 2 PE permitem atingir outro alvo adjacente ao original ou aumentar o multiplicador de crítico em +1."],
        ["NEX 65% - Técnica Sublime", "Acrescenta opções à Técnica Secreta: margem +2 (ou +5 ao escolher duas vezes) e ignorar 5 de resistência a dano."],
        ["NEX 99% - Máquina de Matar", "A favorita reduz categoria em III, ganha margem +2 e um dado adicional de dano."]
    ]);
    group("combatente", "Comandante de Campo", [
        ["NEX 10% - Inspirar Confiança", "Reação e 2 PE permitem a um aliado em alcance curto repetir um teste recém-feito."],
        ["NEX 40% - Estrategista", "Padrão e 1 PE por aliado em alcance curto, até INT aliados: recebem um movimento adicional no próximo turno."],
        ["NEX 65% - Brecha na Guarda", "Uma vez por rodada, após dano causado por aliado próximo, reação e 2 PE concedem um ataque extra no mesmo inimigo. As habilidades anteriores passam a alcance médio."],
        ["NEX 99% - Oficial Comandante", "Padrão e 5 PE concedem uma ação padrão extra, no próximo turno, a cada aliado visível em alcance médio."]
    ]);
    group("combatente", "Guerreiro", [
        ["NEX 10% - Técnica Letal", "Ataques corpo a corpo ganham +2 na margem de ameaça."],
        ["NEX 40% - Revidar", "Após bloquear, reação e 2 PE permitem atacar corpo a corpo o agressor."],
        ["NEX 65% - Força Opressora", "Após acertar em corpo a corpo, 1 PE permite derrubar ou empurrar. Empurrar ganha +5 por 10 de dano; derrubar com sucesso permite outro ataque por 1 PE."],
        ["NEX 99% - Potência Máxima", "Com arma corpo a corpo, dobra os bônus numéricos de Ataque Especial."]
    ]);
    group("combatente", "Operações Especiais", [
        ["NEX 10% - Iniciativa Aprimorada", "Iniciativa +5 e uma ação de movimento extra na primeira rodada."],
        ["NEX 40% - Ataque Extra", "Uma vez por rodada, ao atacar, 2 PE permitem outro ataque."],
        ["NEX 65% - Surto de Adrenalina", "Uma vez por rodada, 5 PE concedem uma ação padrão ou movimento extra."],
        ["NEX 99% - Sempre Alerta", "Recebe uma ação padrão extra no começo de cada cena de combate."]
    ]);
    group("combatente", "Tropa de Choque", [
        ["NEX 10% - Casca Grossa", "Ganha +1 PV por avanço de 5% de NEX e soma VIG à resistência do bloqueio."],
        ["NEX 40% - Cai Dentro", "Reação e 1 PE para redirecionar para você um ataque contra aliado próximo; Vontade DT VIG evita. Exige que o agressor possa atingir você."],
        ["NEX 65% - Duro de Matar", "Reação e 2 PE reduzem dano não paranormal à metade. A partir de NEX 85%, também funciona com dano paranormal."],
        ["NEX 99% - Inquebrável", "Machucado: Defesa +5 e RD 5. Morrendo: continua agindo sem ficar indefeso, mas as demais regras de morte permanecem."]
    ]);
    group("especialista", "Poderes de Especialista", [martial,
        ["Balística Avançada", "Proficiência em armas táticas de fogo e +2 no dano dessas armas."],
        ["Conhecimento Aplicado", "Um teste de perícia pode usar INT por 2 PE, exceto Luta e Pontaria.", "INT 2"],
        ["Eclético", "Por 2 PE, um teste recebe os benefícios de treinamento na perícia utilizada."],
        ["Engenhosidade", "Eclético pode conceder veterano por +2 PE em NEX 40%, ou expert por +4 PE em NEX 75%."],
        ["Hacker", "Invadir sistemas com Tecnologia ganha +5 e leva uma ação completa.", "Treino em Tecnologia"],
        ["Mãos Rápidas", "Um teste de Crime pode ser feito como ação livre por 1 PE.", "AGI 3; treino em Crime"],
        ["Mochila de Utilidades", "Escolhe um item não-armamento para reduzir sua categoria em I e sua ocupação em 1 espaço."],
        ["Movimento Tático", "Por 1 PE, ignora reduções de deslocamento por terreno difícil e escalada durante o turno.", "Treino em Atletismo"],
        ["Na Trilha Certa", "Após achar uma pista, 1 PE dá +1d20 na próxima busca. Sucessos consecutivos permitem aumentar o custo e o bônus cumulativamente."],
        ["Nerd", "Uma vez por cena: 2 PE e Atualidades DT 20 para obter uma informação útil definida pelo mestre."],
        ["Ninja Urbano", "Proficiência em armas táticas corpo a corpo e de disparo não-fogo; +2 no dano dessas armas."],
        ["Pensamento Ágil", "Em investigação, 2 PE concedem uma busca de pistas adicional, uma vez por rodada."],
        ["Perito", "Escolhe duas perícias treinadas, exceto Luta/Pontaria. Em seus testes, 2 PE somam 1d6; a progressão libera dados maiores por PE adicional."],
        ["Perito em Explosivos", "Explosivos somam INT à DT de resistência e podem poupar até INT alvos da explosão."],
        ["Primeira Impressão", "O primeiro teste de Diplomacia, Enganação, Intimidação ou Intuição da cena recebe +2d20."], transcend, training
    ]);
    group("especialista", "Atirador de Elite", [
        ["NEX 10% - Mira de Elite", "Proficiência em armas de fogo de balas longas; soma INT ao dano com elas."],
        ["NEX 40% - Disparo Letal", "Ao mirar, 1 PE dá margem +2 ao próximo ataque até o fim do próximo turno."],
        ["NEX 65% - Disparo Impactante", "Arma de fogo com calibre grosso: 2 PE permitem derrubar, desarmar, empurrar ou quebrar à distância."],
        ["NEX 99% - Atirar para Matar", "Um crítico de arma de fogo causa dano máximo, dispensando a rolagem."]
    ]);
    group("especialista", "Infiltrador", [
        ["NEX 10% - Ataque Furtivo", "Uma vez por rodada, 1 PE adiciona 1d6 de dano contra alvo desprevenido ou flanqueado, em corpo a corpo/alcance curto. Evolui para 2d6/3d6/4d6 em NEX 40/65/99%."],
        ["NEX 40% - Gatuno", "Atletismo e Crime +5; pode esconder-se movendo seu deslocamento completo sem penalidade."],
        ["NEX 65% - Assassinar", "Movimento e 3 PE analisam um alvo curto. O próximo Ataque Furtivo até o próximo turno dobra seus dados extras; Fortitude DT AGI evita inconsciência ou morrendo."],
        ["NEX 99% - Sombra Fugaz", "Por 3 PE, ignora a penalidade de −3d20 para esconder-se após uma ação chamativa."]
    ]);
    group("especialista", "Médico de Campo", [
        ["NEX 10% - Paramédico", "Padrão e 2 PE curam 2d10 PV em você ou aliado adjacente. NEX 40/65/99% liberam +1d10 por +1 PE."],
        ["NEX 40% - Equipe de Trauma", "Padrão e 2 PE removem uma condição negativa de aliado adjacente, exceto morrendo."],
        ["NEX 65% - Resgate", "Uma vez por rodada, pode aproximar-se de aliado ferido próximo como ação livre. Curá-lo dá Defesa +5 a ambos até o próximo turno; carregá-lo ocupa metade dos espaços."],
        ["NEX 99% - Reanimação", "Uma vez por cena, ação completa e 10 PE revivem alguém morto naquela cena, exceto por dano massivo."]
    ]);
    group("especialista", "Negociador", [
        ["NEX 10% - Eloquência", "Completa e 1 PE por alvo curto: Diplomacia/Enganação/Intimidação contra Vontade para fascinar. Sustentar custa ação padrão; hostis têm bônus e novos testes."],
        ["NEX 40% - Discurso Motivador", "Padrão e 4 PE dão +1d20 nas perícias de você e aliados próximos pela cena. Em NEX 65%, 8 PE dão +2d20."],
        ["NEX 65% - Eu Conheço um Cara", "Uma vez por missão, solicita um favor à rede de contatos; possibilidades e disponibilidade dependem do mestre."],
        ["NEX 99% - Truque de Mestre", "Por 5 PE, reproduz uma habilidade vista em um aliado naquela cena, ignorando requisitos mas pagando os demais custos e usando seus próprios parâmetros."]
    ]);
    group("especialista", "Técnico", [
        ["NEX 10% - Inventário Otimizado", "A capacidade de carga passa a considerar FOR + INT."],
        ["NEX 40% - Remendão", "Completa e 1 PE anulam quebrado em equipamento adjacente até o fim da cena. Equipamentos gerais têm categoria reduzida em I."],
        ["NEX 65% - Improvisar", "Completa e 2 PE, mais 2 PE por categoria, criam um equipamento geral improvisado. Categoria e espaços normais; deixa de funcionar ao fim da cena."],
        ["NEX 99% - Preparado para Tudo", "Movimento e 3 PE por categoria permitem encontrar na bolsa um item não-arma; ele passa a ocupar o inventário normalmente."]
    ]);
    group("ocultista", "Poderes de Ocultista", [
        ["Camuflar Ocultismo", "Oculta sigilos como ação livre. Um ritual por +2 PE dispensa gestos e componentes; percebê-lo exige Ocultismo DT 25."],
        ["Criar Selo", "Uma ação de interlúdio e o custo do ritual em PE fabricam um selo de ritual conhecido. Pode manter até PRE selos."],
        ["Envolto em Mistério", "Enganação e Intimidação +5 contra pessoas sem treino em Ocultismo, conforme a situação definida pelo mestre."],
        ["Escolhido pelo Outro Lado", "Começa com três rituais de 1º círculo e aprende outro por avanço. Libera círculos 2/3/4 em NEX 25/55/85%; esses rituais não ocupam o limite de conhecidos."],
        ["Especialista em Elemento", "Escolhe um elemento cujos rituais terão DT de resistência +2."],
        ["Ferramentas Paranormais", "Um item paranormal tem categoria reduzida em I; ativar itens paranormais dispensa o custo de PE."],
        ["Fluxo de Poder", "Uma ação livre sustenta dois efeitos simultâneos, pagando separadamente seus custos.", "NEX 60%"],
        ["Guiado pelo Paranormal", "Uma vez por cena, 2 PE concedem uma ação extra de investigação."],
        ["Identificação Paranormal", "Ocultismo +10 ao identificar criaturas, objetos e rituais."],
        ["Improvisar Componentes", "Uma vez por cena, completa e Investigação DT 15 encontram componentes de um elemento, se o ambiente permitir."],
        ["Intuição Paranormal", "Ao facilitar investigação, soma INT ou PRE ao teste, à escolha."],
        ["Mestre em Elemento", "Reduz em 1 PE o custo de rituais de um elemento escolhido.", "Especialista em Elemento correspondente; NEX 45%"],
        ["Ritual Potente", "Rituais somam INT ao dano ou à cura.", "INT 2"],
        ["Ritual Predileto", "Escolhe um ritual conhecido cujo custo diminui em 1 PE, acumulando com outras reduções."],
        ["Tatuagem Ritualística", "Reduz em 1 PE os rituais pessoais que tenham você como alvo."], transcend, training
    ]);
    group("ocultista", "Conduíte", [
        ["NEX 10% - Ampliar Ritual", "Ao conjurar, +2 PE aumentam o alcance em um passo ou dobram a área do ritual."],
        ["NEX 40% - Acelerar Ritual", "Uma vez por rodada, +4 PE fazem um ritual ser conjurado como ação livre."],
        ["NEX 65% - Anular Ritual", "Ao ser alvo de ritual, paga seu custo em PE e disputa Ocultismo com o conjurador; vencer cancela o ritual."],
        ["NEX 99% - Canalizar o Medo", "Aprende o ritual Canalizar o Medo."]
    ]);
    group("ocultista", "Flagelador", [
        ["NEX 10% - Poder do Flagelo", "Pode pagar rituais com 2 PV por PE. Esses PV só são recuperados por descanso."],
        ["NEX 40% - Abraçar a Dor", "Reação e 2 PE reduzem à metade um dano não paranormal recebido."],
        ["NEX 65% - Absorver Agonia", "Ao zerar PV de inimigos com um ritual, recebe PE temporários iguais ao círculo usado."],
        ["NEX 99% - Medo Tangível", "Aprende o ritual Medo Tangível."]
    ]);
    group("ocultista", "Graduado", [
        ["NEX 10% - Saber Ampliado", "Aprende um ritual extra de 1º círculo e outro ao liberar cada círculo; ficam fora do limite de conhecidos."],
        ["NEX 40% - Grimório Ritualístico", "Grimório de 1 espaço guarda INT rituais de 1º/2º círculo e novos rituais ao liberar círculos. Consultá-lo exige ação completa; reconstrução usa dois interlúdios."],
        ["NEX 65% - Rituais Eficientes", "Todos os rituais ganham +5 na DT de resistência."],
        ["NEX 99% - Conhecendo o Medo", "Aprende o ritual Conhecendo o Medo."]
    ]);
    group("ocultista", "Intuitivo", [
        ["NEX 10% - Mente Sã", "Testes de resistência contra efeitos paranormais recebem +5."],
        ["NEX 40% - Presença Poderosa", "PRE aumenta o limite de PE por turno apenas para conjuração; não altera a DT."],
        ["NEX 65% - Inabalável", "RD mental e paranormal 10; sucesso em Vontade contra dano paranormal que seria reduzido à metade passa a anulá-lo."],
        ["NEX 99% - Presença do Medo", "Aprende o ritual Presença do Medo."]
    ]);
    group("ocultista", "Lâmina Paranormal", [
        ["NEX 10% - Lâmina Maldita", "Aprende Amaldiçoar Arma; se já conhecido, +1 PE o torna movimento. Arma afetada pode atacar usando Ocultismo."],
        ["NEX 40% - Gladiador Paranormal", "Acertos corpo a corpo geram 2 PE temporários, até o limite de PE por cena; expiram no fim da cena."],
        ["NEX 65% - Conjuração Marcial", "Uma vez por rodada, após ritual de ação padrão, 2 PE permitem ataque corpo a corpo como ação livre."],
        ["NEX 99% - Lâmina do Medo", "Aprende o ritual Lâmina do Medo."]
    ]);
    group("origens", "Habilidades de origem", [
        ["110%", "Testes de FOR ou AGI, exceto Luta/Pontaria, podem receber +5 por 2 PE.", "", "", "Atleta"],
        ["Acalentar", "Religião para acalmar recebe +5; ao acalmar, restaura 1d6 + PRE de Sanidade.", "", "", "Religioso"],
        ["Calejado", "Ganha +1 PV a cada avanço de 5% de NEX.", "", "", "Desgarrado"],
        ["Cicatrizes Psicológicas", "Ganha +1 Sanidade a cada avanço de 5% de NEX.", "", "", "Vítima"],
        ["Dedicação", "Ganha +1 PE inicial e outro nos avanços ímpares (15%, 25% etc.); limite de PE por turno +1, sem alterar DT.", "", "", "Universitário"],
        ["Desbravador", "2 PE dão +5 em Adestramento ou Sobrevivência. Terreno difícil não reduz o deslocamento.", "", "", "Trabalhador Rural"],
        ["Espírito Cívico", "Ao ajudar, 1 PE aumenta em +2 o bônus concedido.", "", "", "Servidor Público"],
        ["Eu Já Sabia", "Resistência a dano mental igual ao INT.", "", "", "Teórico da Conspiração"],
        ["Faro para Pistas", "Uma vez por cena, uma busca de pistas ganha +5 por 1 PE.", "", "", "Investigador"],
        ["Ferramenta de Trabalho", "Escolhe uma arma simples/tática adequada à profissão com aprovação do mestre: proficiência e +1 no ataque, dano e margem.", "", "", "Operário"],
        ["Ferramentas Favoritas", "Escolhe um item não-arma para reduzir sua categoria em I.", "", "", "Engenheiro"],
        ["Impostor", "Uma vez por cena, 2 PE substituem um teste de perícia por Enganação.", "", "", "Trambiqueiro"],
        ["Ingrediente Secreto", "Cozinhar no interlúdio concede dois benefícios de alimentação ao grupo que se alimentar; escolhas iguais acumulam.", "", "", "Chef"],
        ["Magnum Opus", "Uma vez por missão, pode ser reconhecido numa interação: +5 em PRE e suas perícias contra esse personagem, com avaliação do mestre.", "", "", "Artista"],
        ["Mão Pesada", "Dano de ataques corpo a corpo recebe +2.", "", "", "Lutador"],
        ["Motor de Busca", "Com internet e aprovação do mestre, 2 PE substituem um teste de perícia por Tecnologia.", "", "", "T.I."],
        ["O Crime Compensa", "Reserva um item encontrado na missão para não contar no limite de itens por patente na próxima missão.", "", "", "Criminoso"],
        ["Para Bellum", "Armas de fogo causam +2 de dano.", "", "", "Militar"],
        ["Patrocinador da Ordem", "O limite de crédito é tratado como uma categoria acima.", "", "", "Magnata"],
        ["Patrulha", "A Defesa recebe +2.", "", "", "Policial"],
        ["Posição de Combate", "No primeiro turno de uma cena de ação, 2 PE concedem um movimento extra.", "", "", "Mercenário"],
        ["Processo Otimizado", "2 PE dão +5 em testes estendidos ou revisão de documentos.", "", "", "Executivo"],
        ["Saber é Poder", "Testes baseados em INT podem receber +5 por 2 PE.", "", "", "Acadêmico"],
        ["Técnica Medicinal", "Soma INT aos PV restaurados ao curar alguém.", "", "", "Agente de Saúde"],
        ["Traços do Outro Lado", "Escolhe um poder paranormal, mas começa com metade da Sanidade inicial da classe.", "", "", "Cultista Arrependido"],
        ["Vislumbres do Passado", "Uma vez por sessão: INT DT 10 para reconhecer alguém ou lugar do passado; sucesso concede 1d4 PE temporários e uma informação do mestre.", "", "", "Amnésico"]
    ]);
    group("paranormal", "Conhecimento", [
        ["Expansão de Conhecimento", "Aprende um poder de outra classe, respeitando seus requisitos.", "Conhecimento 1", "Aprende um segundo poder de outra classe."],
        ["Percepção Paranormal", "Ao buscar pistas, pode repetir um dado menor que 10 e deve aceitar o novo resultado.", "", "Permite repetir até dois dados menores que 10."],
        ["Precognição", "Defesa e testes de resistência recebem +2.", "Conhecimento 1", "Também concede imunidade a desprevenido."],
        ["Sensitivo", "Diplomacia, Intimidação e Intuição recebem +5.", "", "Em testes opostos com essas perícias, o adversário sofre −1d20."],
        ["Visão do Oculto", "Percepção +5 e visão no escuro.", "", "Também ignora camuflagem."]
    ]);
    group("paranormal", "Energia", [
        ["Afortunado", "Uma vez por rolagem, pode repetir um resultado 1 em dado que não seja d20.", "", "Uma vez por teste, também permite repetir um 1 em d20."],
        ["Campo Protetor", "Ao esquivar, 1 PE concede Defesa +5.", "Energia 1", "Também dá Reflexos +5; sucesso para reduzir dano à metade passa a anulá-lo até o próximo turno."],
        ["Causalidade Fortuita", "Buscar pistas tem DT −5 até encontrar a primeira pista da cena de investigação.", "", "A redução vale para todas as buscas de pistas."],
        ["Golpe de Sorte", "Ataques ganham +1 na margem de ameaça.", "Energia 1", "Também aumenta o multiplicador de crítico em +1."],
        ["Manipular Entropia", "Por 2 PE, outro alvo em alcance curto repete um dado de um teste de perícia.", "Energia 1", "Pode escolher todos os dados que o alvo repetirá."]
    ]);
    group("paranormal", "Morte", [
        ["Encarar a Morte", "Limite de PE por turno +1 em cenas de ação; DT inalterada.", "", "O aumento passa a +3 no total."],
        ["Escapar da Morte", "Uma vez por cena, dano que zeraria seus PV deixa você com 1 PV; não evita dano massivo.", "Morte 1", "Anula o dano; se for massivo, deixa você com 1 PV."],
        ["Potencial Aprimorado", "Ganha +1 PE por avanço de 5% de NEX, incluindo avanços anteriores.", "", "O bônus passa a +2 PE por avanço."],
        ["Potencial Reaproveitado", "Uma vez por rodada, passar numa resistência concede 2 PE temporários, cumulativos até o fim da cena.", "", "Concede 3 PE temporários em vez de 2."],
        ["Surto Temporal", "Uma vez por cena, em seu turno, 3 PE concedem uma ação padrão extra.", "Morte 2", "Pode ser usado uma vez por turno."]
    ]);
    group("paranormal", "Sangue", [
        ["Anatomia Insana", "Um resultado par em 1d4 ignora o dano adicional de crítico ou ataque furtivo.", "Sangue 2", "Torna-se imune aos efeitos de críticos e ataques furtivos."],
        ["Arma de Sangue", "Movimento e 2 PE criam arma simples leve de 1d6 Sangue até o fim da cena. Ao agredir, 1 PE permite um ataque extra com ela uma vez por turno.", "", "Arma permanente de 1d10 Sangue."],
        ["Sangue de Ferro", "Ganha +2 PV por avanço de 5% de NEX, incluindo avanços anteriores.", "", "Fortitude +5 e imunidade a doenças e venenos."],
        ["Sangue Fervente", "Enquanto machucado, recebe +1 em FOR ou AGI, escolhendo a cada ativação.", "Sangue 2", "O aumento de atributo passa a +2."],
        ["Sangue Vivo", "Ao ficar machucado pela primeira vez na cena, ganha cura acelerada 2, sem ultrapassar metade dos PV; termina ao deixar de estar machucado ou encerrar a cena.", "Sangue 1", "A cura acelerada passa a 5."]
    ]);
    group("paranormal", "Varia", [
        ["Aprender Ritual", "Aprende um ritual de 1º círculo e pode trocar outro conhecido. Em NEX 45/75%, libera 2º/3º círculo. É repetível, respeita o limite de conhecidos e conta para o elemento escolhido."],
        ["Resistir a <Elemento>", "Escolhe Conhecimento, Energia, Morte ou Sangue para receber resistência 10; conta como poder desse elemento.", "", "A resistência passa a 20."]
    ]);
    const catalog = Object.freeze(rows);
    function normalize(text) { return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR"); }
    function classification(item) { return [item.kind, categories[item.category], item.origin || item.subgroup, item.minNex ? `NEX ${item.minNex}%` : ""].filter(Boolean).join(" · "); }
    function duplicate(item, entries, originName) {
        if (item.origin && normalize(originName) === normalize(item.name)) return true;
        if (item.repeatable) return false;
        return entries.some(entry => entry && (entry.abilityCatalogId === item.id || normalize(entry.name) === normalize(item.name) || normalize(entry.name) === normalize(`${item.name} (Afinidade)`)));
    }
    function entry(item, id, withAffinity, notes) {
        return { id, name: `${item.name}${withAffinity && item.affinity ? " (Afinidade)" : ""}`, abilityCatalogId: item.id,
            category: item.category, subgroup: item.subgroup, group: item.book, abilityKind: item.kind, origin: item.origin,
            minNex: item.minNex, requirements: item.requirements, affinity: Boolean(withAffinity && item.affinity),
            description: [item.description, withAffinity && item.affinity ? `Afinidade: ${item.affinity}` : "", notes ? `Escolhas/anotações: ${notes}` : ""].filter(Boolean).join("\n\n") };
    }
    const api = Object.freeze({ catalog, categories, normalize, classification, duplicate, entry });
    scope.REAL_ABILITY_CATALOG = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
