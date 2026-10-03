// Livro de Regras: 26 origens, conferidas na criação do C.R.I.S. em 02/10/2026.
// Descrições e efeitos são resumos próprios; fonte compartilhada com a ficha pronta.
(function (scope) {
    function origin(id, name, description, skills, trainedSkills, ability, effect, extra = {}) {
        return Object.freeze({ id, name, description, skills, trainedSkills: Object.freeze(trainedSkills), ability, effect,
            book: "Ordem Paranormal · Livro de Regras", source: "https://crisordemparanormal.com/novo-agente", ...extra });
    }
    const origins = Object.freeze([
        origin("academico", "Acadêmico", "Sua vida de pesquisa e ensino levou você a conhecimentos que ultrapassam a ciência comum.",
            "Ciências e Investigação", ["ciencias", "investigacao"], "Saber é Poder", "Ao fazer um teste baseado em Intelecto, pode gastar 2 PE para receber +5 nesse teste."),
        origin("agente-de-saude", "Agente de Saúde", "Você trabalhava cuidando da saúde das pessoas e encontrou algo que a medicina não conseguia explicar.",
            "Intuição e Medicina", ["intuicao", "medicina"], "Técnica Medicinal", "Ao curar um personagem, soma seu Intelecto aos PV restaurados."),
        origin("amnesico", "Amnésico", "Você perdeu a maior parte das lembranças. A Ordem é a família que conhece agora, mas cada missão pode revelar um pedaço do passado.",
            "Duas perícias à escolha do mestre", [], "Vislumbres do Passado", "Uma vez por sessão: Intelecto DT 10 para reconhecer alguém ou um lugar do seu passado. Em um sucesso, recebe 1d4 PE temporários e uma informação útil, a critério do mestre.", { choiceCount: 2 }),
        origin("artista", "Artista", "Você se expressava pela arte. Uma obra ou experiência criativa chamou a atenção da Ordem.",
            "Artes e Enganação", ["artes", "enganacao"], "Magnum Opus", "Uma vez por missão, pode escolher alguém em uma cena de interação para reconhecer sua obra. Contra essa pessoa, recebe +5 em testes de Presença e de perícias baseadas em Presença. O mestre pode permitir o bônus em outras situações de reconhecimento."),
        origin("atleta", "Atleta", "Você treinava e competia, aprendendo a levar seu corpo ao limite antes de enfrentar o paranormal.",
            "Acrobacia e Atletismo", ["acrobacia", "atletismo"], "110%", "Em um teste de perícia baseado em Força ou Agilidade, exceto Luta e Pontaria, pode gastar 2 PE para receber +5."),
        origin("chef", "Chef", "Cozinhar era seu ofício ou sua paixão. Agora, suas refeições ajudam o grupo a enfrentar as missões.",
            "Fortitude e Profissão (cozinheiro)", ["fortitude", "profissao"], "Ingrediente Secreto", "No interlúdio, pode usar alimentar-se para preparar um prato especial. Você e os membros do grupo que se alimentarem recebem os benefícios de dois pratos; benefícios repetidos se acumulam.", { professionSpecialty: "cozinheiro" }),
        origin("criminoso", "Criminoso", "Você viveu fora da lei e acabou envolvido com a Ordem. Seu passado pode ser um recurso — ou um problema.",
            "Crime e Furtividade", ["crime", "furtividade"], "O Crime Compensa", "Ao fim de uma missão, escolha um item encontrado. Na próxima missão, ele pode entrar no inventário sem contar no limite de itens por patente."),
        origin("cultista-arrependido", "Cultista Arrependido", "Você fez parte de um culto paranormal, mas decidiu lutar do outro lado. Conquistar a confiança da Ordem ainda é um desafio.",
            "Ocultismo e Religião", ["ocultismo", "religiao"], "Traços do Outro Lado", "Recebe um poder paranormal à escolha, mas começa com metade da Sanidade inicial normal da classe."),
        origin("desgarrado", "Desgarrado", "Você aprendeu a viver fora das convenções e sem os confortos de uma rotina comum.",
            "Fortitude e Sobrevivência", ["fortitude", "sobrevivencia"], "Calejado", "Recebe +1 PV para cada avanço de 5% de NEX."),
        origin("engenheiro", "Engenheiro", "Você construía, consertava ou inventava coisas. Um de seus projetos aproximou você do paranormal.",
            "Profissão e Tecnologia", ["profissao", "tecnologia"], "Ferramentas Favoritas", "Escolha um item, exceto arma: ele conta como uma categoria abaixo para você."),
        origin("executivo", "Executivo", "Seu trabalho envolvia negócios, documentos e burocracia, até que uma descoberta mudou seus planos.",
            "Diplomacia e Profissão", ["diplomacia", "profissao"], "Processo Otimizado", "Pode gastar 2 PE para receber +5 em um teste de perícia de um teste estendido ou ao revisar documentos físicos ou digitais."),
        origin("investigador", "Investigador", "Você procurava respostas em casos e mistérios, profissionalmente ou por conta própria.",
            "Investigação e Percepção", ["investigacao", "percepcao"], "Faro para Pistas", "Uma vez por cena, ao fazer um teste para procurar pistas, pode gastar 1 PE para receber +5."),
        origin("lutador", "Lutador", "Você aprendeu a lutar no esporte, nas artes marciais ou na rua. Sua experiência chamou a atenção da Ordem.",
            "Luta e Reflexos", ["luta", "reflexos"], "Mão Pesada", "Recebe +2 nas rolagens de dano de ataques corpo a corpo."),
        origin("magnata", "Magnata", "Você tinha recursos e patrimônio suficientes para financiar uma causa muito maior que seus negócios.",
            "Diplomacia e Pilotagem", ["diplomacia", "pilotagem"], "Patrocinador da Ordem", "Seu limite de crédito é tratado como uma categoria acima do atual."),
        origin("mercenario", "Mercenário", "Você oferecia serviços de combate e segurança, até encontrar ameaças que dinheiro algum explicava.",
            "Iniciativa e Intimidação", ["iniciativa", "intimidacao"], "Posição de Combate", "No primeiro turno de cada cena de ação, pode gastar 2 PE para receber uma ação de movimento adicional."),
        origin("militar", "Militar", "Você serviu em uma força militar e levou sua disciplina e treinamento para as missões da Ordem.",
            "Pontaria e Tática", ["pontaria", "tatica"], "Para Bellum", "Recebe +2 nas rolagens de dano com armas de fogo."),
        origin("operario", "Operário", "Sua experiência com trabalho braçal, ferramentas e máquinas lhe deu uma maneira prática de resolver problemas.",
            "Fortitude e Profissão", ["fortitude", "profissao"], "Ferramenta de Trabalho", "Escolha, com aprovação do mestre, uma arma simples ou tática que sirva como ferramenta de sua profissão. Sabe usá-la e recebe +1 em ataques, dano e margem de ameaça com essa arma. A arma escolhida deve ser registrada com a mesa."),
        origin("policial", "Policial", "Você atuava na segurança pública e sobreviveu a uma ocorrência que fugia de qualquer explicação normal.",
            "Percepção e Pontaria", ["percepcao", "pontaria"], "Patrulha", "Recebe +2 em Defesa."),
        origin("religioso", "Religioso", "Você acolhia pessoas por meio da fé e de práticas espirituais antes de conhecer o Outro Lado.",
            "Religião e Vontade", ["religiao", "vontade"], "Acalentar", "Recebe +5 em Religião para acalmar. Ao acalmar uma pessoa, ela recupera 1d6 + sua Presença em Sanidade."),
        origin("servidor-publico", "Servidor Público", "Você trabalhava em um órgão público, atendendo pessoas e lidando com uma rotina de burocracia.",
            "Intuição e Vontade", ["intuicao", "vontade"], "Espírito Cívico", "Ao fazer um teste para ajudar, pode gastar 1 PE para aumentar em +2 o bônus concedido."),
        origin("teorico-da-conspiracao", "Teórico da Conspiração", "Você pesquisava explicações ocultas para acontecimentos comuns. Algumas descobertas eram mais reais do que imaginava.",
            "Investigação e Ocultismo", ["investigacao", "ocultismo"], "Eu Já Sabia", "Recebe resistência a dano mental igual ao seu Intelecto."),
        origin("ti", "T.I.", "Você lidava com computadores, redes e sistemas. Sua habilidade ou curiosidade levou você até a Ordem.",
            "Investigação e Tecnologia", ["investigacao", "tecnologia"], "Motor de Busca", "Com acesso à internet e a critério do mestre, pode gastar 2 PE para substituir um teste de perícia por Tecnologia."),
        origin("trabalhador-rural", "Trabalhador Rural", "Você trabalhava no campo ou em lugares isolados, acostumando-se à natureza e aos animais.",
            "Adestramento e Sobrevivência", ["adestramento", "sobrevivencia"], "Desbravador", "Pode gastar 2 PE para receber +5 em um teste de Adestramento ou Sobrevivência. Terreno difícil não reduz seu deslocamento."),
        origin("trambiqueiro", "Trambiqueiro", "Você sobrevivia de golpes e conversa convincente. Agora pode usar sua lábia a serviço da Ordem.",
            "Crime e Enganação", ["crime", "enganacao"], "Impostor", "Uma vez por cena, pode gastar 2 PE para substituir um teste de qualquer perícia por Enganação."),
        origin("universitario", "Universitário", "Durante os estudos e a vida universitária, você encontrou algo que não estava no currículo.",
            "Atualidades e Investigação", ["atualidades", "investigacao"], "Dedicação", "Recebe +1 PE inicial e mais +1 nos avanços ímpares de NEX (15%, 25% e assim por diante). Seu limite de PE por turno aumenta em 1, sem alterar a DT de seus efeitos."),
        origin("vitima", "Vítima", "Você sofreu um encontro traumático com o paranormal e decidiu impedir que outros passem pelo mesmo.",
            "Reflexos e Vontade", ["reflexos", "vontade"], "Cicatrizes Psicológicas", "Recebe +1 de Sanidade para cada avanço de 5% de NEX.")
    ]);
    scope.REAL_ORIGINS = origins;
    if (typeof module !== "undefined" && module.exports) module.exports = origins;
})(typeof window !== "undefined" ? window : globalThis);
