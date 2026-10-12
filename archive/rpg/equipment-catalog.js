(function (scope) {
    const collections = Object.freeze([
        Object.freeze({ name: "Ordem Paranormal", cover: null })
    ]);
    const items = Object.freeze([
        Object.freeze({
            id: "acha", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Acha",
            weaponClass: "Armas Táticas", weaponStyle: "Corpo a Corpo", hands: "Duas Mãos",
            category: 1, damage: "1d12", damageType: "corte", critical: "x3", space: 2,
            description: "Um machado grande e pesado, usado no corte de árvores largas."
        }),
        Object.freeze({
            id: "arco", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Arco",
            weaponClass: "Armas Simples", weaponStyle: "Arma de Disparo", hands: "Duas Mãos",
            category: 0, range: "médio", damage: "1d6", damageType: "perfuração", critical: "x3", space: 2, ammunition: "Flechas",
            description: "Um arco e flecha comum, próprio para tiro ao alvo."
        }),
        Object.freeze({
            id: "arco-composto", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Arco Composto",
            weaponClass: "Armas Táticas", weaponStyle: "Arma de Disparo", hands: "Duas Mãos",
            category: 1, range: "médio", damage: "1d10", damageType: "perfuração", critical: "x3", space: 2, ammunition: "Flechas",
            description: "Este arco moderno usa materiais de alta tensão e um sistema de roldanas para gerar mais pressão. Ao contrário de outras armas de disparo, permite que você aplique seu valor de Força às rolagens de dano."
        }),
        Object.freeze({
            id: "balestra", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Balestra",
            weaponClass: "Armas Táticas", weaponStyle: "Arma de Disparo", hands: "Duas Mãos",
            category: 1, range: "médio", damage: "1d12", damageType: "perfuração", critical: 19, space: 2, ammunition: "Flechas",
            description: "Uma besta pesada, capaz de disparos poderosos. Exige uma ação de movimento para ser recarregada a cada disparo."
        }),
        Object.freeze({
            id: "bastao", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Bastão",
            weaponClass: "Armas Simples", weaponStyle: "Corpo a Corpo", hands: "Uma Mão",
            category: 0, damage: "1d6/1d8", damageType: "impacto", critical: "x2", space: 1,
            description: "Um cilindro de madeira maciça. Pode ser um taco de beisebol, um cacetete da polícia, uma tonfa ou apenas uma clava envolta em pregos ou arame farpado. Você pode empunhar um bastão com uma mão (dano 1d6) ou com as duas (dano 1d8)."
        }),
        Object.freeze({
            id: "bazuca", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Bazuca",
            weaponClass: "Armas Pesadas", weaponStyle: "Arma de Fogo", hands: "Duas Mãos",
            category: 3, range: "médio", damage: "10d8", damageType: "impacto", critical: "x2", space: 2, ammunition: "Foguete",
            description: "Este lança-foguetes foi concebido como uma arma anti-tanques, mas também se mostrou eficaz contra criaturas. A bazuca causa seu dano no alvo atingido e em todos os seres num raio de 3m; esses seres (mas não o alvo atingido diretamente) têm direito a um teste de Reflexos (DT Agi) para reduzir o dano à metade. Você pode disparar o foguete num ponto qualquer em alcance médio, em vez de num ser específico; nesse caso, não precisa rolar ataque e não tem chance de errar (mas também não acerta nenhum ser diretamente). A bazuca exige uma ação de movimento para ser recarregada a cada disparo."
        }),
        Object.freeze({
            id: "besta", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Besta",
            weaponClass: "Armas Simples", weaponStyle: "Arma de Disparo", hands: "Duas Mãos",
            category: 0, range: "médio", damage: "1d8", damageType: "perfuração", critical: 19, space: 2, ammunition: "Flechas",
            description: "Esta arma da antiguidade exige uma ação de movimento para ser recarregada a cada disparo."
        }),
        Object.freeze({
            id: "cajado", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Cajado",
            weaponClass: "Armas Simples", weaponStyle: "Corpo a Corpo", hands: "Duas Mãos",
            category: 0, damage: "1d6/1d6", damageType: "impacto", critical: "x2", space: 2,
            description: "Um cabo de madeira ou barra de ferro longo. Usado em artes marciais. É uma arma ágil. Além disso, pode ser usado com Combater com Duas Armas (e poderes similares) para fazer ataques adicionais, como se fosse uma arma de uma mão e uma arma leve."
        }),
        Object.freeze({
            id: "corrente", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Corrente",
            weaponClass: "Armas Táticas", weaponStyle: "Corpo a Corpo", hands: "Uma Mão",
            category: 0, damage: "1d8", damageType: "impacto", critical: "x2", space: 1,
            description: "Um pedaço de corrente grossa pode ser usado como uma arma bastante efetiva. A corrente fornece +2 em testes para desarmar e derrubar."
        }),
        Object.freeze({
            id: "espada", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Espada",
            weaponClass: "Armas Táticas", weaponStyle: "Corpo a Corpo", hands: "Uma Mão",
            category: 1, damage: "1d8/1d10", damageType: "corte", critical: 19, space: 1,
            description: "Uma arma medieval, como uma espada longa dos cavaleiros europeus ou uma cimitarra sarracena. Você pode empunhar uma espada com uma mão (dano 1d8) ou com as duas (dano 1d10)."
        }),
        Object.freeze({
            id: "espingarda", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Espingarda",
            weaponClass: "Armas Táticas", weaponStyle: "Arma de Fogo", hands: "Duas Mãos",
            category: 1, range: "curto", damage: "4d6", damageType: "balístico", critical: "x3", space: 2, ammunition: "Cartuchos",
            description: "Arma de fogo longa e com cano liso. A espingarda causa apenas metade do dano em alcance médio ou maior."
        }),
        Object.freeze({
            id: "faca",
            group: "Ordem Paranormal",
            inventoryCategory: "armas",
            name: "Faca",
            weaponClass: "Armas Simples",
            weaponStyle: "Corpo a Corpo",
            weaponTraits: "Leve",
            category: 0,
            range: "curto",
            damage: "1d4",
            damageType: "corte",
            critical: 19,
            space: 1,
            description: "Uma lâmina longa e afiada, como uma navalha, uma faca de churrasco ou uma faca militar (facas de cozinha pequena causam apenas 1d3 pontos de dano). É uma arma ágil e pode ser arremessada."
        }),
        Object.freeze({
            id: "florete", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Florete",
            weaponClass: "Armas Táticas", weaponStyle: "Corpo a Corpo", hands: "Uma Mão",
            category: 1, damage: "1d6", damageType: "corte", critical: 18, space: 1,
            description: "Esta espada de lâmina fina e comprida é usada por esgrimistas. É uma arma ágil."
        }),
        Object.freeze({
            id: "fuzil-de-assalto", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Fuzil de Assalto",
            weaponClass: "Armas Táticas", weaponStyle: "Arma de Fogo", hands: "Duas Mãos",
            category: 2, range: "médio", damage: "2d10", damageType: "balístico", critical: "19/x3", space: 2, ammunition: "Balas Longas",
            description: "A arma de fogo padrão da maioria dos exércitos modernos. É uma arma automática."
        }),
        Object.freeze({
            id: "fuzil-de-caca", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Fuzil de Caça",
            weaponClass: "Armas Simples", weaponStyle: "Arma de Fogo", hands: "Duas Mãos",
            category: 1, range: "médio", damage: "2d8", damageType: "balístico", critical: "19/x3", space: 2, ammunition: "Balas Longas",
            description: "Esta arma de fogo é bastante popular entre fazendeiros, caçadores e atiradores esportistas."
        }),
        Object.freeze({
            id: "fuzil-de-precisao", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Fuzil de Precisão",
            weaponClass: "Armas Táticas", weaponStyle: "Arma de Fogo", hands: "Duas Mãos",
            category: 3, range: "longo", damage: "2d10", damageType: "balístico", critical: "19/x3", space: 2, ammunition: "Balas Longas",
            description: "Esta arma de fogo de uso militar é projetada para disparos longos e precisos. Se for veterano em Pontaria e mirar com um fuzil de precisão, você recebe +5 na margem de ameaça de seu ataque."
        }),
        Object.freeze({
            id: "gadanho", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Gadanho",
            weaponClass: "Armas Táticas", weaponStyle: "Corpo a Corpo", hands: "Duas Mãos",
            category: 1, damage: "2d4", damageType: "corte", critical: "x4", space: 2,
            description: "Uma ferramenta agrícola, o gadanho é uma versão maior da foice, para uso com as duas mãos. Foi criada para ceifar cereais, mas também pode ceifar vidas."
        }),
        Object.freeze({
            id: "katana", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Katana",
            weaponClass: "Armas Táticas", weaponStyle: "Corpo a Corpo", hands: "Duas Mãos",
            category: 1, damage: "1d10", damageType: "corte", critical: 19, space: 2,
            description: "Originária do Japão, esta espada longa e levemente curvada transcendeu os séculos. É uma arma ágil. Se você for veterano em Luta pode usá-la como uma arma de uma mão."
        }),
        Object.freeze({
            id: "lanca", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Lança",
            weaponClass: "Armas Simples", weaponStyle: "Corpo a Corpo", hands: "Uma Mão",
            category: 0, range: "curto", damage: "1d6", damageType: "perfuração", critical: "x2", space: 1,
            description: "Uma haste de madeira com uma ponta metálica afiada, a lança é uma arma arcaica, mas usada ainda hoje por artistas marciais. Pode ser arremessada."
        }),
        Object.freeze({
            id: "lanca-chamas", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Lança-chamas",
            weaponClass: "Armas Pesadas", weaponStyle: "Arma de Fogo", hands: "Duas Mãos",
            category: 3, range: "curto", damage: "6d6", damageType: "fogo", critical: "x2", space: 2, ammunition: "Combustível",
            description: "Equipamento militar que esguicha líquido inflamável incandescente. Um lança-chamas atinge todos os seres em uma linha de 1,5m de largura com alcance curto, mas não alcança além disso. Faça um único teste de ataque e compare o resultado com a Defesa de todos os seres na área. Além de sofrer dano, seres atingidos ficam em chamas."
        }),
        Object.freeze({
            id: "maca", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Maça",
            weaponClass: "Armas Táticas", weaponStyle: "Corpo a Corpo", hands: "Uma Mão",
            category: 1, damage: "2d4", damageType: "impacto", critical: "x2", space: 1,
            description: "Bastão com uma cabeça metálica cheia de protuberâncias."
        }),
        Object.freeze({
            id: "machadinha", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Machadinha",
            weaponClass: "Armas Táticas", weaponStyle: "Corpo a Corpo", weaponTraits: "Leve",
            category: 0, range: "curto", damage: "1d6", damageType: "corte", critical: "x3", space: 1,
            description: "Ferramenta útil para cortar madeira, pode ser facilmente encontrada em canteiros de obras e fazendas. Pode ser arremessada."
        }),
        Object.freeze({
            id: "machado", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Machado",
            weaponClass: "Armas Táticas", weaponStyle: "Corpo a Corpo", hands: "Uma Mão",
            category: 1, damage: "1d8", damageType: "corte", critical: "x3", space: 1,
            description: "Uma ferramenta importante para lenhadores e bombeiros, um machado pode causar ferimentos terríveis."
        }),
        Object.freeze({
            id: "machete", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Machete",
            weaponClass: "Armas Simples", weaponStyle: "Corpo a Corpo", hands: "Uma Mão",
            category: 0, damage: "1d6", damageType: "corte", critical: 19, space: 1,
            description: "Uma lâmina longa, muito usada como ferramenta para abrir trilhas."
        }),
        Object.freeze({
            id: "marreta", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Marreta",
            weaponClass: "Armas Táticas", weaponStyle: "Corpo a Corpo", hands: "Duas Mãos",
            category: 1, damage: "3d4", damageType: "impacto", critical: "x2", space: 2,
            description: "Normalmente usada para demolir paredes, também pode ser usada para demolir pessoas. Use estas estatísticas para outras ferramentas de construção civil, como picaretas."
        }),
        Object.freeze({
            id: "martelo", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Martelo",
            weaponClass: "Armas Simples", weaponStyle: "Corpo a Corpo", weaponTraits: "Leve",
            category: 0, damage: "1d6", damageType: "impacto", critical: "x2", space: 1,
            description: "Esta ferramenta comum pode ser usada como arma na falta de opções melhores."
        }),
        Object.freeze({
            id: "metralhadora", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Metralhadora",
            weaponClass: "Armas Pesadas", weaponStyle: "Arma de Fogo", hands: "Duas Mãos",
            category: 2, range: "médio", damage: "2d12", damageType: "balístico", critical: "19/x3", space: 2, ammunition: "Balas Longas",
            description: "Uma arma de fogo pesada, de uso militar. Para atacar com uma metralhadora, você precisa ter Força 4 ou maior ou gastar uma ação de movimento para apoiá-la em seu tripé ou suporte apropriado; caso contrário, sofre -5 em seus ataques. Uma metralhadora é uma arma automática."
        }),
        Object.freeze({
            id: "montante", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Montante",
            weaponClass: "Armas Táticas", weaponStyle: "Corpo a Corpo", hands: "Duas Mãos",
            category: 1, damage: "2d6", damageType: "corte", critical: 19, space: 2,
            description: "Enorme e pesada, esta espada de 1,5m de comprimento foi uma das armas mais poderosas em seu tempo."
        }),
        Object.freeze({
            id: "motosserra", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Motosserra",
            weaponClass: "Armas Táticas", weaponStyle: "Corpo a Corpo", hands: "Duas Mãos",
            category: 1, damage: "3d6", damageType: "corte", critical: "x2", space: 2,
            description: "Uma ferramenta motorizada capaz de causar ferimentos profundos; sempre que rolar um 6 em um dado de dano com uma motosserra, role um dado de dano adicional. Apesar de potente, esta arma é muito desajeitada e impõe uma penalidade de -1d20 nos seus testes de ataque. Ligar uma motosserra gasta uma ação de movimento."
        }),
        Object.freeze({
            id: "nunchaku", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Nunchaku",
            weaponClass: "Armas Táticas", weaponStyle: "Corpo a Corpo", weaponTraits: "Leve",
            category: 0, damage: "1d8", damageType: "impacto", critical: "x2", space: 1,
            description: "Dois bastões curtos de madeira ligados por uma corrente. É uma arma ágil."
        }),
        Object.freeze({
            id: "pistola", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Pistola",
            weaponClass: "Armas Simples", weaponStyle: "Arma de Fogo", weaponTraits: "Leve",
            category: 1, range: "curto", damage: "1d12", damageType: "balístico", critical: 18, space: 1, ammunition: "Balas Curtas",
            description: "Uma arma de mão comum entre policiais e militares por ser facilmente recarregável."
        }),
        Object.freeze({
            id: "punhal", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Punhal",
            weaponClass: "Armas Simples", weaponStyle: "Corpo a Corpo", weaponTraits: "Leve",
            category: 0, damage: "1d4", damageType: "perfuração", critical: "x3", space: 1,
            description: "Uma faca de lâmina longa e pontiaguda, usada por cultistas em seus rituais. É uma arma ágil."
        }),
        Object.freeze({
            id: "revolver", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Revólver",
            weaponClass: "Armas Simples", weaponStyle: "Arma de Fogo", weaponTraits: "Leve",
            category: 1, range: "curto", damage: "2d6", damageType: "balístico", critical: "19/x3", space: 1, ammunition: "Balas Curtas",
            description: "A arma de fogo mais comum, e uma das mais confiáveis."
        }),
        Object.freeze({
            id: "submetralhadora", group: "Ordem Paranormal", inventoryCategory: "armas", name: "Submetralhadora",
            weaponClass: "Armas Táticas", weaponStyle: "Arma de Fogo", hands: "Uma Mão",
            category: 1, range: "curto", damage: "2d6", damageType: "balístico", critical: "19/x3", space: 1, ammunition: "Balas Curtas",
            description: "Esta arma de fogo automática pode ser empunhada com apenas uma mão."
        }),
        Object.freeze({
            id: "balas-curtas", group: "Ordem Paranormal", inventoryCategory: "municoes", name: "Balas Curtas",
            category: 0, space: 1,
            description: "Munição básica, usada em pistolas, revólveres e submetralhadoras. Um pacote de balas curtas dura duas cenas."
        }),
        Object.freeze({
            id: "balas-longas", group: "Ordem Paranormal", inventoryCategory: "municoes", name: "Balas Longas",
            category: 1, space: 1,
            description: "Maior e mais potente, esta munição é usada em fuzis e metralhadoras. Um pacote de balas longas dura uma cena."
        }),
        Object.freeze({
            id: "cartuchos", group: "Ordem Paranormal", inventoryCategory: "municoes", name: "Cartuchos",
            category: 1, space: 1,
            description: "Usados em espingardas, esses cartuchos são carregados com esferas de chumbo. Um pacote de cartuchos dura uma cena."
        }),
        Object.freeze({
            id: "combustivel", group: "Ordem Paranormal", inventoryCategory: "municoes", name: "Combustível",
            category: 1, space: 1,
            description: "Um tanque de combustível para lança-chamas. Dura uma cena."
        }),
        Object.freeze({
            id: "flechas", group: "Ordem Paranormal", inventoryCategory: "municoes", name: "Flechas",
            category: 0, space: 1,
            description: "Usadas em arcos e bestas, flechas podem ser reaproveitadas após cada combate. Por isso, um pacote de flechas dura uma missão inteira."
        }),
        Object.freeze({
            id: "foguete", group: "Ordem Paranormal", inventoryCategory: "municoes", name: "Foguete",
            category: 1, space: 1,
            description: "Disparado por bazucas. Ao contrário de outras munições, cada foguete dura um único disparo, não uma cena. Para fazer vários ataques, você precisará carregar vários foguetes."
        }),
        Object.freeze({
            id: "escudo", group: "Ordem Paranormal", inventoryCategory: "protecao", name: "Escudo",
            defense: 2, category: 1, space: 2,
            description: "Um escudo medieval ou moderno, como aqueles usados por tropas de choque. Para efeitos de proficiência, conta como proteção pesada. Precisa ser empunhado em uma mão e fornece Defesa +2."
        }),
        Object.freeze({
            id: "protecao-leve", group: "Ordem Paranormal", inventoryCategory: "protecao", name: "Proteção Leve",
            defense: 5, category: 1, space: 2,
            description: "Jaqueta de couro pesada ou um colete de kevlar. Essa proteção é tipicamente usada por seguranças e policiais."
        }),
        Object.freeze({
            id: "protecao-pesada", group: "Ordem Paranormal", inventoryCategory: "protecao", name: "Proteção Pesada",
            defense: 10, category: 2, space: 5,
            description: "Equipamento usado por forças especiais da polícia e pelo exército. Consiste de capacete, ombreiras, joelheiras e caneleiras, além de um colete com várias camadas de kevlar. Fornece resistência a balístico, corte, impacto e perfuração 2. No entanto, por ser desconfortável e volumosa, impõe -5 em testes de perícias que sofrem penalidade de carga."
        }),
        Object.freeze({
            id: "algemas", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Algemas",
            itemType: "Itens Operacionais", category: 0, space: 1,
            description: "Um par de algemas de aço. Para prender uma pessoa que não esteja indefesa você precisa empunhar a algema, agarrar a pessoa e então vencer um novo teste de agarrar contra ela. Você pode prender os dois pulsos da pessoa (-5 em testes que exijam o uso das mãos, impede conjuração) ou um dos pulsos dela em um objeto imóvel adjacente, caso haja, para impedir que ela se mova. Escapar das algemas exige um teste de Acrobacia contra DT 30 (ou ter as chaves...)."
        }),
        Object.freeze({
            id: "amarras-de-elemento", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Amarras de (Elemento)",
            itemType: "Itens Paranormais", category: 2, space: 1,
            description: "Cordas ou correntes feitas de um elemento Paranormal específico. As amarras são preparadas para imobilizar criaturas do Outro Lado que sejam vulneráveis ao elemento que as compõem e podem ser usadas de duas formas.\n\nArmadilha. Você gasta as amarras, uma ação completa e 2 PE e prepara uma armadilha de 3x3m. Uma criatura que atravesse o espaço pela primeira vez em seu turno precisa fazer um teste de Reflexos (DT Int); se falhar, fica imóvel até o final da cena. Mesmo se passar, considera o espaço ocupado pela armadilha como terreno difícil.\n\nLaçar. Você gasta uma ação padrão e 1 PE e escolhe uma criatura em alcance curto. Se falhar num teste de Vontade (DT Agi), a criatura fica paralisada até o início de seu próximo turno, quando pode repetir o teste. Manter a criatura enlaçada requer o gasto de 1 PE por rodada."
        }),
        Object.freeze({
            id: "arpeu", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Arpéu",
            itemType: "Itens Operacionais", category: 0, space: 1,
            description: "Um gancho de aço amarrado na ponta de uma corda para se fixar em muros, janelas, parapeitos de prédios... Prender um arpéu exige um teste de Pontaria (DT 15). Subir um muro com a ajuda de uma corda fornece +5 no teste de Atletismo."
        }),
        Object.freeze({
            id: "bandoleira", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Bandoleira",
            itemType: "Itens Operacionais", category: 1, space: 1,
            description: "Um cinto com bolsos e alças. Uma vez por rodada, você pode sacar ou guardar um item em seu inventário como uma ação livre."
        }),
        Object.freeze({
            id: "binoculos", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Binóculos",
            itemType: "Itens Operacionais", category: 0, space: 1,
            description: "Estes binóculos militares fornecem +5 em testes de Percepção para observar coisas distantes."
        }),
        Object.freeze({
            id: "bloqueador-de-sinal", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Bloqueador de Sinal",
            itemType: "Itens Operacionais", category: 1, space: 1,
            description: "Este dispositivo compacto emite ondas que “poluem” a frequência de rádio usada por celulares, impedindo que qualquer aparelho desse tipo em alcance médio se conecte."
        }),
        Object.freeze({
            id: "camera-de-aura-paranormal", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Câmera de Aura Paranormal",
            itemType: "Itens Paranormais", category: 2, space: 1,
            description: "Esta câmera amaldiçoada com Energia possui sigilos de Conhecimento para capturar auras paranormais. Tirar uma foto gasta uma ação padrão e 1 PE. As fotos são instantâneas e revelam a presença de auras paranormais em pessoas e objetos. As auras são da cor associada ao elemento."
        }),
        Object.freeze({
            id: "cicatrizante", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Cicatrizante",
            itemType: "Itens Operacionais", category: 1, space: 1,
            description: "Um spray contendo um remédio com potente efeito cicatrizante. Você pode gastar uma ação padrão e este item para curar 2d8+2 PV em você ou em um ser adjacente."
        }),
        Object.freeze({
            id: "componentes-ritualisticos-de-elemento", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Componentes Ritualísticos de (Elemento)",
            itemType: "Itens Paranormais", category: 0, space: 1,
            description: "Um conjunto de objetos utilizados em rituais de um elemento entre Sangue, Morte, Conhecimento ou Energia (não existem componentes ritualísticos de Medo). Componentes ritualísticos são necessários para a conjuração de rituais do elemento em questão.\n\nEnergia: eletricidade, dispositivos tecnológicos (celulares, computadores etc.), circuitos eletrônicos, fontes de calor e luz, pilhas, baterias, cabos de cobre e prata, pólvora, moedas, dados, ímãs...\n\nSangue: órgãos, carne, sangue, animais vivos (para sacrifício), navalhas, agulhas, arame farpado, correntes, metal enferrujado, fluídos corporais...\n\nMorte: ossos, dentes, cinzas, fios de cabelo, cristais pretos, relógios, galhos secos, folhas secas, plantas mortas, raízes, areia, poeira, Lodo...\n\nConhecimento: escrituras, papéis, livros, pergaminhos, pedras preciosas, ouro, cordas, tecido, cristais brancos, vidro, máscaras, instrumentos de escrita (lápis, caneta, tinta, giz etc.)..."
        }),
        Object.freeze({
            id: "corda", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Corda",
            itemType: "Itens Operacionais", category: 0, space: 1,
            description: "Um rolo com 10 metros de corda resistente. Possui diversas utilidades: pode ajudar a descer um buraco ou prédio (+5 em testes de Atletismo nessas situações), amarrar pessoas inconscientes etc."
        }),
        Object.freeze({
            id: "emissor-de-pulsos-paranormais", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Emissor de Pulsos Paranormais",
            itemType: "Itens Paranormais", category: 2, space: 1,
            description: "Esta pequena caixa coberta de sigilos foi desenvolvida para servir como uma “isca” de criaturas paranormais. Ativar a caixa gasta uma ação completa e 1 PE. A caixa emite um pulso de um elemento definido pelo ativador, que atrai criaturas do mesmo elemento e afasta criaturas do elemento oposto. As criaturas afetadas têm direito a um teste de Vontade (DT Pre) para evitar o efeito."
        }),
        Object.freeze({
            id: "equipamento-de-sobrevivencia", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Equipamento de Sobrevivência",
            itemType: "Itens Operacionais", category: 0, space: 2,
            description: "Uma mochila com saco de dormir, panelas, GPS e outros itens úteis para sobreviver no mato. Fornece +5 em testes de Sobrevivência para acampar e orientar-se e permite que você faça esses testes sem treinamento."
        }),
        Object.freeze({
            id: "escuta-de-ruidos-paranormais", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Escuta de Ruídos Paranormais",
            itemType: "Itens Paranormais", category: 2, space: 1,
            description: "Este microfone funciona como um aparato espião, com a diferença que consegue captar ruídos paranormais. Ativar a escuta gasta uma ação completa e 2 PE e faz com que ela grave ruídos por até 24 horas. Ouvir a escuta fornece +5 em testes de Ocultismo para identificar criatura."
        }),
        Object.freeze({
            id: "granada-de-atordoamento", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Granada de Atordoamento",
            itemType: "Explosivos", category: 0, space: 1,
            description: "Para usar uma granada, você precisa empunhá-la e então gastar uma ação padrão para arremessá-la em um ponto à sua escolha em alcance médio. A granada afeta um raio de 6m a partir do ponto de impacto. O efeito que ela causa varia conforme o tipo de granada.\n\nTambém chamadas de flash-bang, por criarem um estouro barulhento e luminoso. Seres na área ficam atordoados por 1 rodada (Fortitude DT Agi reduz para ofuscado e surdo por uma rodada)."
        }),
        Object.freeze({
            id: "granada-de-fragmentacao", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Granada de Fragmentação",
            itemType: "Explosivos", category: 1, space: 1,
            description: "Para usar uma granada, você precisa empunhá-la e então gastar uma ação padrão para arremessá-la em um ponto à sua escolha em alcance médio. A granada afeta um raio de 6m a partir do ponto de impacto. O efeito que ela causa varia conforme o tipo de granada.\n\nEspalha fragmentos perfurantes. Seres na área sofrem 8d6 pontos de dano de perfuração (Reflexos DT Agi reduz à metade)."
        }),
        Object.freeze({
            id: "granada-de-fumaca", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Granada de Fumaça",
            itemType: "Explosivos", category: 0, space: 1,
            description: "Para usar uma granada, você precisa empunhá-la e então gastar uma ação padrão para arremessá-la em um ponto à sua escolha em alcance médio. A granada afeta um raio de 6m a partir do ponto de impacto. O efeito que ela causa varia conforme o tipo de granada.\n\nProduz uma fumaça espessa e escura. Seres na área ficam cegos e sob camuflagem total. A fumaça dura 2 rodadas."
        }),
        Object.freeze({
            id: "granada-incendiaria", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Granada Incendiária",
            itemType: "Explosivos", category: 1, space: 1,
            description: "Para usar uma granada, você precisa empunhá-la e então gastar uma ação padrão para arremessá-la em um ponto à sua escolha em alcance médio. A granada afeta um raio de 6m a partir do ponto de impacto. O efeito que ela causa varia conforme o tipo de granada.\n\nEspalha labaredas incandescentes. Seres na área sofrem 6d6 pontos de dano de fogo e ficam em chamas (Reflexos DT Agi reduz o dano à metade e evita a condição em chamas)."
        }),
        Object.freeze({
            id: "kit-de-pericia", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Kit de Perícia",
            itemType: "Acessórios", category: 0, space: 1,
            description: "Um conjunto de ferramentas necessárias para algumas perícias ou usos de perícias. Sem o kit, você sofre -5 no teste. Existe um kit de perícia para cada perícia que exige este item."
        }),
        Object.freeze({
            id: "lanterna-tatica", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Lanterna Tática",
            itemType: "Itens Operacionais", category: 1, space: 1,
            description: "Ilumina lugares escuros. Além disso, você pode gastar uma ação de movimento para mirar a luz nos olhos de um ser em alcance curto. Ele fica ofuscado por 1 rodada, mas imune à lanterna pelo resto da cena."
        }),
        Object.freeze({
            id: "mascara-de-gas", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Máscara de Gás",
            itemType: "Itens Operacionais", category: 0, space: 1,
            description: "Uma máscara com filtro que cobre o rosto inteiro. Fornece +10 em testes de Fortitude contra efeitos que dependam de respiração."
        }),
        Object.freeze({
            id: "medidor-de-estabilidade-da-membrana", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Medidor de Estabilidade da Membrana",
            itemType: "Itens Paranormais", category: 2, space: 1,
            description: "Um dispositivo complexo, composto por diversos medidores — de temperatura, campo magnético, dilatação temporal... Um agente treinado em Ocultismo pode usar o medidor para avaliar o estado da Membrana em uma área, o que indica a chance de uma entidade se manifestar nela. Um ambiente com valores racionais e constantes ao longo de algumas horas dificilmente originará uma criatura ou manifestação perigosa. Porém, se as leituras apresentarem dados inexplicáveis ou com grandes variações, o lugar poderá conter uma entidade. Apesar de ser um bom indicativo, o medidor não fornece respostas definitivas, já que um ambiente com a Membrana danificada ainda pode não ter sido afetado por manifestações, assim como um lugar com a Membrana protegida por conter uma criatura poderosa vinda de outro lugar."
        }),
        Object.freeze({
            id: "mina-antipessoal", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Mina Antipessoal",
            itemType: "Explosivos", category: 1, space: 1,
            description: "Esta mina é ativada por controle remoto. Se você estiver a até alcance longo dela, pode gastar uma ação padrão para detoná-la. Ao explodir, a mina dispara centenas de bolas de aço em um cone de 6m, causando 12d6 pontos de dano de perfuração em todos os seres na área (Reflexos DT Int reduz à metade). Você define a direção do cone quando posiciona a mina no chão. Instalar a mina exige uma ação completa e um teste de Tática contra DT 15. Caso falhe, você gasta a mina, mas ela não funciona. Encontrar uma mina instalada exige um teste de Percepção (DT igual ao resultado do seu teste para instalá-la)."
        }),
        Object.freeze({
            id: "mochila-militar", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Mochila Militar",
            itemType: "Itens Operacionais", category: 1, space: -2,
            description: "Uma mochila leve e de alta qualidade. Ela não usa nenhum espaço e aumenta sua capacidade de carga em 2 espaços."
        }),
        Object.freeze({
            id: "oculos-de-visao-termica", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Óculos de Visão Térmica",
            itemType: "Itens Operacionais", category: 1, space: 1,
            description: "Estes óculos eliminam a penalidade em testes por camuflagem."
        }),
        Object.freeze({
            id: "pe-de-cabra", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Pé de Cabra",
            itemType: "Itens Operacionais", category: 0, space: 1,
            description: "Esta barra de ferro fornece +5 em testes de Força para arrombar portas. Pode ser usada em combate como um bastão."
        }),
        Object.freeze({
            id: "pistola-de-dardos", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Pistola de Dardos",
            itemType: "Itens Operacionais", category: 1, space: 1,
            description: "Esta arma dispara dardos com um poderoso sonífero. Para disparar em um ser, faça um ataque à distância contra ele. Se acertá-lo, ele fica inconsciente até o fim da cena (Fortitude DT Agi reduz para desprevenido e lento por uma rodada). A pistola vem com 2 dardos. Uma caixa adicional com 2 dardos é um item de categoria 0 que ocupa 1 espaço."
        }),
        Object.freeze({
            id: "pistola-sinalizadora", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Pistola Sinalizadora",
            itemType: "Itens Operacionais", category: 0, space: 1,
            description: "Esta pistola dispara um sinalizador luminoso, útil para chamar outras pessoas para sua localização. Pode ser usada uma vez como uma arma de disparo leve com alcance curto que causa 2d6 pontos de dano de fogo. A pistola vem com 2 cargas. Uma caixa adicional com 2 cargas é um item de categoria 0 que ocupa 1 espaço."
        }),
        Object.freeze({
            id: "scanner-de-manifestacao-paranormal-de-elemento", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Scanner de Manifestação Paranormal de (Elemento)",
            itemType: "Itens Paranormais", category: 2, space: 1,
            description: "Este item é composto por um dispositivo conectado a pequenos objetos amaldiçoados de uma entidade específica e adornado com uma série de sigilos. Ativar o scanner é uma ação padrão. Quando ativado, o scanner consome 1 PE por rodada do usuário, que sempre sabe a direção de todas as manifestações paranormais ativas (rituais, criaturas, itens amaldiçoados etc.) do elemento escolhido em alcance longo. Se o elemento principal de uma criatura for outro, mas ela tiver como complemento o elemento escolhido do scanner, também será detectada."
        }),
        Object.freeze({
            id: "soqueira", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Soqueira",
            itemType: "Itens Operacionais", category: 0, space: 1,
            description: "Esta peça de metal é usada entre os dedos e permite socos mais perigosos — fornece +1 em rolagens de dano desarmado. Uma soqueira pode receber modificações e maldições de armas corpo a corpo e aplica os efeitos delas em seus ataques desarmados."
        }),
        Object.freeze({
            id: "spray-de-pimenta", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Spray de Pimenta",
            itemType: "Itens Operacionais", category: 1, space: 1,
            description: "Este spray dispara um composto químico que causa dor e lacrimejo. Você pode gastar uma ação padrão para atingir um ser adjacente. O ser fica cego por 1d4 rodadas (Fortitude DT Agi evita). A carga do spray dura dois usos."
        }),
        Object.freeze({
            id: "taser", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Taser",
            itemType: "Itens Operacionais", category: 1, space: 1,
            description: "Um dispositivo de eletrochoque capaz de atordoar ou até incapacitar um alvo. Você pode gastar uma ação padrão para atingir um ser adjacente. O alvo sofre 1d6 pontos de dano de eletricidade e fica atordoado por uma rodada (Fortitude DT Agi evita). A bateria do taser dura dois usos."
        }),
        Object.freeze({
            id: "traje-hazmat", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Traje Hazmat",
            itemType: "Itens Operacionais", category: 1, space: 2,
            description: "Uma roupa impermeável e que cobre o corpo inteiro, usada para impedir o contato do usuário com materiais tóxicos. Fornece +5 em testes de resistência contra efeitos ambientais e resistência a químico 10."
        }),
        Object.freeze({
            id: "utensilio", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Utensílio",
            itemType: "Acessórios", category: 1, space: 1,
            description: "Um item comum que tenha uma utilidade específica, como um canivete, uma lupa, um smartphone ou um notebook. Um utensílio concede +2 em um teste de uma perícia a sua escolha (exceto Luta e Pontaria), definida quando o item é adquirido. Por exemplo, um smartphone pode ser usado para acessar a internet e fornecer bônus em Ciências, enquanto um notebook pode ser preparado para invadir sistemas e fornecer bônus em Tecnologia. Você pode inventar itens menos realistas, como um “detector de mentiras portátil” que fornece +2 em Intuição, mas o mestre tem a palavra final se o utensílio é apropriado ou não. Utensílios sempre ocupam 1 espaço e precisam ser empunhados para que o bônus seja aplicado."
        }),
        Object.freeze({
            id: "vestimenta", group: "Ordem Paranormal", inventoryCategory: "geral", name: "Vestimenta",
            itemType: "Acessórios", category: 1, space: 1,
            description: "Uma peça de vestuário que fornece um bônus em uma perícia específica (exceto Luta ou Pontaria). Por exemplo, um par de botas militares pode fornecer +2 em Atletismo, enquanto um terno ou vestido elegante pode fornecer +2 em Diplomacia. Assim como utensílios, o benefício de cada vestimenta deve ser aprovado pelo mestre. Você pode receber os bônus de no máximo duas vestimentas ao mesmo tempo. Vestir ou despir uma vestimenta é uma ação completa."
        }),
        // Regras consultadas no catálogo do CRIS (crisordemparanormal.com), em redação própria.
        Object.freeze({
            id: "amarras-mortais", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Amarras Mortais",
            element: "Morte", category: 2, space: 1,
            description: "Agarrar: uma vez por rodada, use uma ação padrão e 2 PE contra um alvo Grande ou menor em alcance curto. O teste oposto da manobra recebe +10.\n\nCom uma ação de movimento, traga um alvo já agarrado para uma posição adjacente a você."
        }),
        Object.freeze({
            id: "aneis-do-elo-mental", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Anéis do Elo Mental",
            element: "Conhecimento", category: 2, space: 1,
            description: "Ativação: duas pessoas devem usar os anéis durante 24 horas. Depois, permanecem ligadas pelo efeito telepático de Invadir Mente enquanto continuarem usando-os.\n\nNos testes de Vontade, ambas utilizam a melhor quantidade de dados e o melhor bônus disponíveis entre elas. Dano mental recebido por uma também atinge a outra; condições mentais e de medo são igualmente compartilhadas."
        }),
        Object.freeze({
            id: "arcabuz-dos-moretti", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Arcabuz dos Moretti",
            element: "Energia", category: 2, space: 1,
            description: "Arma simples de fogo, empunhada com uma mão: alcance curto, crítico x3 e +2 nos testes de ataque. Dispensa munição.\n\nA cada disparo, role também 1d6 para determinar o dano: 1 → 2d4; 2 → 2d6; 3 → 2d8; 4 → 2d10; 5 → 2d12; 6 → 2d20."
        }),
        Object.freeze({
            id: "bateria-reversa", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Bateria Reversa",
            element: "Energia", category: 2, space: 1,
            description: "Absorver carga: ação padrão e 2 PE; descarrega um dispositivo eletrônico em alcance curto. Devolver carga: se a bateria estiver cheia, uma ação padrão recarrega um dispositivo descarregado no mesmo alcance.\n\nCada utilização exige Ocultismo, DT 15, aumentando em 5 por uso adicional naquele dia. Uma falha provoca explosão: seres a até 3m sofrem 12d6 de dano de Energia."
        }),
        Object.freeze({
            id: "casaco-de-lodo", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Casaco de Lodo",
            element: "Morte", category: 2, space: 1,
            description: "Ao vestir o casaco, receba resistência 5 a corte, impacto, Morte e perfuração. Em contrapartida, você adquire vulnerabilidade a dano balístico e de Energia."
        }),
        Object.freeze({
            id: "coletora", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Coletora",
            element: "Morte", category: 2, space: 1,
            description: "Use uma ação completa para apunhalar uma pessoa morrendo: ela morre, e o punhal armazena 1d8 PE, até um total de 20. Após portar o item por pelo menos uma semana, esses PE podem ser gastos como os seus.\n\nEnquanto carregar a Coletora, o descanso sempre tem condições ruins, acompanhado de pesadelos ligados às vítimas."
        }),
        Object.freeze({
            id: "coracao-pulsante", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Coração Pulsante",
            element: "Sangue", category: 2, space: 1,
            description: "Com o coração empunhado, gaste uma reação ao receber dano para reduzi-lo à metade. Cada uso exige Fortitude, DT 15, com +5 por uso adicional no dia; se falhar, o coração é destruído.\n\nDrene diariamente o compartimento onde o guarda. Caso contrário, o sangue pode vazar e danificar os demais objetos."
        }),
        Object.freeze({
            id: "coroa-de-espinhos", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Coroa de Espinhos",
            element: "Sangue", category: 2, space: 1,
            description: "O efeito começa após uma semana usando o item. Uma vez por rodada, uma reação permite converter o dano mental que você receberia em dano de Sangue.\n\nEnquanto vestir a coroa, descansar não recupera sua sanidade."
        }),
        Object.freeze({
            id: "cranio-espiral", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Crânio Espiral",
            element: "Morte", category: 2, space: 1,
            description: "Com o crânio empunhado, uma ação livre concede uma ação padrão extra, no máximo uma vez por rodada.\n\nA ativação exige Vontade, DT 15, com +5 por uso adicional no dia. Se falhar, ainda recebe a ação, mas envelhece 1d4 anos e perde a possibilidade de ativar o item até o dia seguinte."
        }),
        Object.freeze({
            id: "dedo-decepado", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Dedo Decepado",
            element: "Varia", category: 2, space: 1,
            description: "Depois de uma semana vestindo o dedo, obtenha um poder paranormal de seu antigo dono. O elemento do poder determina o elemento da maldição.\n\nAo dormir ou relaxar em um interlúdio, role 1d4: um resultado 1 impede recuperar PV, PE e sanidade. Se outras pessoas virem você usando o dedo, aplique -10 em Diplomacia; o mestre também pode determinar reações de NPCs."
        }),
        Object.freeze({
            id: "faixas-da-videncia", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Faixas da Vidência",
            element: "Morte", category: 2, space: 1,
            description: "Você fica cego em relação a alvos além do alcance médio. Para efeitos dentro desse alcance, não fica desprevenido, ganha +10 em testes de resistência e +10 na Defesa ao esquivar.\n\nUma vez por cena de investigação, gaste 2 PE para obter uma visão do passado e receber +5 no teste para procurar pistas."
        }),
        Object.freeze({
            id: "frasco-de-lodo", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Frasco de Lodo",
            element: "Morte", category: 2, space: 1,
            description: "Aplicação: ação padrão; o frasco permite apenas um uso. Em um ferimento da rodada atual ou anterior, recupera 6d8+20 PV.\n\nPara ferimentos mais antigos, role um dado: resultado par recupera 3d8+10 PV; resultado ímpar causa 3d8+10 de dano de Morte."
        }),
        Object.freeze({
            id: "frasco-de-vitalidade", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Frasco de Vitalidade",
            element: "Sangue", category: 2, space: 1,
            description: "Encher: gaste um minuto e sofra até 20 pontos de dano, armazenando a mesma quantidade de PV no seu sangue. Ele permanece fresco dentro do frasco.\n\nBeber: uma ação padrão recupera os PV guardados. Faça Fortitude, DT 20; uma falha deixa você enjoado durante uma rodada."
        }),
        Object.freeze({
            id: "jaqueta-de-verissimo", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Jaqueta de Veríssimo",
            element: "Medo", category: 4, space: 1,
            description: "Item único, de categoria IV: apenas um agente pode escolhê-lo. Concede resistência 15 a dano paranormal.\n\nQuando um aliado adjacente estiver prestes a receber dano, uma reação e 2 PE permitem que você receba esse dano em seu lugar, independentemente do tipo."
        }),
        Object.freeze({
            id: "lanterna-reveladora", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Lanterna Reveladora",
            element: "Conhecimento", category: 2, space: 1,
            description: "Ativação: ação padrão e 1 PE. Durante uma cena, a iluminação oferece os efeitos de Terceiro Olho.\n\nCriaturas de Sangue atingidas pela luz priorizam atacar o portador em vez de outros alvos na mesma categoria de alcance."
        }),
        Object.freeze({
            id: "mascara-das-pessoas-nas-sombras", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Máscara das Pessoas nas Sombras",
            element: "Conhecimento", category: 2, space: 1,
            description: "Concede resistência 10 a Conhecimento. Com uma ação de movimento e 2 PE, entre em uma sombra adjacente e apareça em outra sombra visível em alcance médio.\n\nUsar a máscara estabelece um vínculo com a Seita das Máscaras; atrair a atenção de sua mente coletiva pode trazer consequências."
        }),
        Object.freeze({
            id: "municao-jurada", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Munição Jurada",
            element: "Conhecimento", category: 2, space: 1,
            description: "Um ritual de uma hora vincula a bala a um ser conhecido pelo usuário. Contra esse alvo, o disparo recebe +10 no ataque, o dobro da margem de ameaça da arma e +6d12 de dano de Conhecimento.\n\nEnquanto possuir a munição, a obsessão pelo alvo impõe -2 na Defesa e nos ataques contra outros seres."
        }),
        Object.freeze({
            id: "peitoral-da-segunda-chance", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Peitoral da Segunda Chance",
            element: "Energia", category: 2, space: 1,
            description: "Ao chegar a 0 PV, o peitoral consome automaticamente 5 PE do usuário e recupera 4d10 PV. Se os PE forem insuficientes, a reanimação não acontece.\n\nEm cada ativação, há uma chance de 1 em 1d10 de morte instantânea: corpo e equipamentos tornam-se plasma de Energia. Somente o peitoral permanece."
        }),
        Object.freeze({
            id: "pergaminho-da-pertinacia", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Pergaminho da Pertinácia",
            element: "Conhecimento", category: 2, space: 1,
            description: "Uma ação padrão concede 5 PE temporários, disponíveis até o encerramento da cena.\n\nCada ativação exige Ocultismo, DT 15, aumentando em 5 a cada uso adicional no dia. Falhar destrói o pergaminho."
        }),
        Object.freeze({
            id: "perola-de-sangue", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Pérola de Sangue",
            element: "Sangue", category: 2, space: 1,
            description: "Absorva a pérola através da pele com uma ação de movimento. Até o fim da cena, receba +5 nos testes de Agilidade, Força e Vigor e nas perícias baseadas nesses atributos.\n\nAo terminar a cena, faça Fortitude, DT 20. Falhar causa fadiga até o fim do dia; falhar por 5 ou mais deixa você morrendo por parada cardíaca. Morrer dessa maneira transforma você em uma criatura de Sangue com VD próximo do seu NEX, escolhida pelo mestre."
        }),
        Object.freeze({
            id: "punhos-enraivecidos", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Punhos Enraivecidos",
            element: "Sangue", category: 2, space: 1,
            description: "Seus ataques desarmados causam 1d8 de dano de Sangue. Ao acertar, você pode pagar PE para repetir o ataque desarmado contra o mesmo alvo.\n\nCada ataque extra custa 2 PE por ataque já realizado naquele turno: 2 PE para o primeiro extra, mais 4 para o segundo, e assim sucessivamente. A sequência termina quando você erra ou fica sem PE para continuá-la."
        }),
        Object.freeze({
            id: "relogio-de-arnaldo", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Relógio de Arnaldo",
            element: "Energia", category: 2, space: 1,
            description: "Uma vez por rodada, pague PE para repetir a rolagem de qualquer dado que tenha mostrado 1. O primeiro uso do dia custa 1 PE; cada ativação seguinte naquele dia aumenta o custo em 1 PE."
        }),
        Object.freeze({
            id: "selos-paranormais", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Selos Paranormais",
            element: "Varia", category: 2, space: 1,
            description: "A categoria depende do círculo do ritual inscrito: I para o 1º círculo, II para o 2º, III para o 3º e IV para o 4º. O catálogo do CRIS apresenta o registro padrão como categoria II.\n\nEmpunhe o selo e leia seus sigilos em voz alta. A ativação usa uma ação padrão ou a duração de conjuração do ritual, prevalecendo a maior. Você precisa conhecer o ritual ou passar em Ocultismo, DT 20 + seu custo em PE.\n\nO selo é consumido ao conjurar. Aplique O Custo do Paranormal e Invocando o Medo quando pertinentes, e escolha os parâmetros como em uma conjuração própria. Quem conhece o ritual pode usar suas habilidades e versões avançadas, pagando somente os PE adicionais. Componentes ritualísticos são dispensados."
        }),
        Object.freeze({
            id: "seringa-de-transfiguracao", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Seringa de Transfiguração",
            element: "Sangue", category: 2, space: 1,
            description: "Coletar sangue: ação padrão contra um alvo adjacente. Se ele não colaborar, acerte um ataque corpo a corpo.\n\nInjetar: outra ação padrão em uma pessoa adjacente aplica Distorcer Aparência, copiando a aparência do doador durante um dia. Ao acabar o efeito, o alvo rola 1d6; um resultado 1 reduz permanentemente seus PV em 1."
        }),
        Object.freeze({
            id: "talisma-da-sorte", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Talismã da Sorte",
            element: "Energia", category: 2, space: 1,
            description: "Enquanto vestir o talismã, ao receber dano você pode gastar uma reação e 3 PE, rolando 1d4.\n\n2 ou 3: ignora todo o dano. 4: ignora o dano, mas perde o talismã. 1: recebe o dobro do dano original e o talismã também é destruído."
        }),
        Object.freeze({
            id: "teclado-de-conexao-neural", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Teclado de Conexão Neural",
            element: "Energia", category: 2, space: 1,
            description: "Conecte o teclado a um computador com uma ação de movimento. Você consegue operá-lo independentemente de barreiras de tecnologia ou idioma, recebe +10 nos testes para hackear e leva metade do tempo para encontrar arquivos.\n\nCada rodada de utilização causa 1d6 de dano mental ao usuário."
        }),
        Object.freeze({
            id: "tela-do-pesadelo", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Tela do Pesadelo",
            element: "Energia", category: 2, space: 1,
            description: "Prepare a tela com uma ação padrão e 2 PE. A próxima pessoa a tocá-la testa Vontade contra a DT definida pelo usuário +5.\n\nSe falhar, fica atordoada, sofre 4d6 de dano mental e repete o teste na rodada seguinte. O processo se mantém até um sucesso, a vítima enlouquecer ou a tela ser destruída. Depois de disparar o efeito, é necessário ativar a tela novamente para outro uso."
        }),
        Object.freeze({
            id: "veiculo-energizado", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Veículo Energizado",
            element: "Energia", category: 2, space: 1,
            description: "O veículo funciona sem combustível. Para evitar uma colisão, o motorista pode usar uma reação e testar Pilotagem, DT 25.\n\nCom sucesso, veículo e ocupantes assumem momentaneamente forma de Energia e atravessam o obstáculo como seres incorpóreos."
        }),
        Object.freeze({
            id: "vislumbre-do-fim", group: "Ordem Paranormal", inventoryCategory: "amaldicoados", name: "Vislumbre do Fim",
            element: "Morte", category: 2, space: 1,
            description: "Use uma ação de movimento para observar um ser visível e descobrir informações ligadas à sua morte.\n\nPara pessoas comuns, obtém um tempo restante, sujeito a mudanças provocadas pelas ações de Marcados. Para Marcados e criaturas, descobre a pior resistência entre Fortitude, Reflexos e Vontade, além de todas as vulnerabilidades do alvo."
        })
    ]);

    (scope.window || scope).REAL_EQUIPMENT_COLLECTIONS = collections;
    (scope.window || scope).REAL_EQUIPMENT_CATALOG = items;
    (scope.window || scope).REAL_WEAPON_CATALOG = Object.freeze(items.filter((item) => item.inventoryCategory === "armas"));
    if (typeof module !== "undefined" && module.exports) module.exports = items;
})(globalThis);
