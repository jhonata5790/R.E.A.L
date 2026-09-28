// Fonte compartilhada pela criação da ficha e pelas perícias da ficha pronta.
window.REAL_ORIGINS = Object.freeze([
    {
        id: "criminoso", name: "Criminoso",
        description: "Você viveu fora da lei e acabou envolvido com a Ordem. Seu passado pode ser um recurso — ou um problema.",
        skills: "Crime e Furtividade",
        trainedSkills: ["crime", "furtividade"],
        ability: "O Crime Compensa",
        effect: "Ao fim de uma missão, escolha um item encontrado. Na próxima missão, ele pode entrar no inventário sem contar no limite de itens por patente."
    },
    {
        id: "amnesico", name: "Amnésico",
        description: "Você perdeu a maior parte das lembranças. A Ordem é a família que conhece agora, mas cada missão pode revelar um pedaço do passado.",
        skills: "Duas perícias à escolha do mestre",
        trainedSkills: [],
        choiceCount: 2,
        ability: "Vislumbres do Passado",
        effect: "Uma vez por sessão, faça um teste de Intelecto (DT 10) ao encontrar alguém ou algum lugar familiar. Se passar, receba 1d4 PE temporários e uma informação útil, a critério do mestre."
    },
    {
        id: "cultista-arrependido", name: "Cultista Arrependido",
        description: "Você fez parte de um culto paranormal, mas decidiu lutar do outro lado. Conquistar a confiança da Ordem ainda é um desafio.",
        skills: "Ocultismo e Religião",
        trainedSkills: ["ocultismo", "religiao"],
        ability: "Traços do Outro Lado",
        effect: "Escolha um poder paranormal. Você começa o jogo com metade da Sanidade normal para a sua classe."
    }
]);
