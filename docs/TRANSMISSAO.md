# Transmissão da mesa

O mestre abre **Transmissão e convite**. **Pausar visão** congela o canvas enviado e a imagem publicada; a prévia local continua como rascunho. **Retomar visão** confirma a nova imagem no servidor antes de liberar o vídeo. A pausa não encerra o convite. Apontadores ficam indisponíveis enquanto a visão está congelada.

O jogador escolhe Automática, Econômica (imagem), Equilibrada ou Alta. A preferência fica só naquele navegador. Automática começa com imagem no celular, com economia de dados ou conexão lenta; no vídeo, ajusta individualmente resolução, bitrate e quadros por segundo usando as medidas da conexão. Uma conexão ruim não reduz a qualidade dos outros espectadores.

O painel de espectadores combina o recebimento **informado pelo jogador** com a latência/perda medidas no WebRTC quando disponíveis. Presença sozinha não confirma recebimento de vídeo. Relatórios antigos não são apresentados como atuais.

Reconexão: erros de conexão e negociação expirada refazem o vídeo com espera progressiva; o botão Reconectar também reabre o canal se necessário. Conserva a imagem publicada ou o último quadro de vídeo. O watchdog só considera congelamento quando uma publicação nova exigia progresso: cena parada e pausa não são defeito. Em segundo plano, o vídeo e as consultas param para economizar bateria.

Tela cheia, pinça, arraste com zoom, botões +/− e Recentralizar atuam só na visão do jogador. Em navegadores sem a API de fullscreen há um modo ampliado dentro da página. Apontadores são sobreposições temporárias assinadas pelo mestre e não movem tokens; pontos fora da área publicada são rejeitados.

## TURN — preparado, ainda sem serviço contratado

A função `tabletop-ice-config` já aceita a mesma chave pública e o UUID secreto de uma sala ativa. Sem configuração, responde somente STUN e `relayAvailable: false`. A transmissão mantém a imagem de reserva. Nenhum servidor TURN foi contratado ou criado.

Para ativar depois, use um servidor compatível com **TURN REST / coturn use-auth-secret** e configure estes segredos somente nas Edge Functions do Supabase:

- `REAL_TURN_URLS`: JSON com os endereços TURN, por exemplo `["turn:relay.seudominio:3478?transport=udp", "turns:relay.seudominio:5349?transport=tcp"]`.
- `REAL_TURN_SHARED_SECRET`: o mesmo segredo forte configurado no servidor TURN. Nunca colocar no HTML, configuração pública, repositório ou navegador.

A função assina credenciais HMAC-SHA1 com validade de 10 a 15 minutos. O navegador recebe apenas essas credenciais temporárias e renova a configuração ao criar uma conexão. Encerre a mesa para interromper novas emissões; credenciais já emitidas podem funcionar até expirar. Quem possui o convite pode consumir o relay durante esse intervalo.

Antes de ativar: configurar certificados TLS para `turns`, portas/firewall, bloqueio de destinos internos/loopback/multicast, limites de largura de banda e quotas de alocações por usuário e totais; acompanhar custos. Não habilitar relay aberto sem autenticação. Depois validar entre redes diferentes (por exemplo Wi-Fi e 4G), comprovando candidato **relay** nos diagnósticos WebRTC. Esta validação externa ainda depende do serviço TURN.

Referências oficiais: [coturn e TURN REST](https://github.com/coturn/coturn/blob/master/README.turnserver), [segredos no Supabase](https://supabase.com/docs/guides/functions/secrets), [parâmetros de vídeo](https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender/setParameters).
