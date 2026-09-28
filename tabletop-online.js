// Transmissão da visão publicada. O mapa completo continua somente no navegador do mestre.
(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);
    const config = window.REAL_SUPABASE_CONFIG;
    const master = window.REAL_TABLETOP_MASTER;
    const status = $("onlineStatus");
    const authForm = $("onlineAuthForm");
    const controls = $("onlineMasterControls");
    const toggle = $("onlineToggle");
    const invite = $("onlineInvite");
    const copy = $("onlineCopy");
    let client;
    let user = null;
    let room = null;
    let channel = null;
    let publishTimer = null;
    let publishing = false;
    let publishAgain = false;

    function say(message) { status.textContent = message; }

    function inviteUrl(code) {
        const url = new URL("mesa-jogador.html", location.href);
        url.hash = new URLSearchParams({ convite: code }).toString();
        return url.href;
    }

    function showState() {
        authForm.hidden = !!user;
        controls.hidden = !user;
        if (!user) return;
        $("onlineMasterName").textContent = `Mestre: ${user.email || "conta conectada"}`;
        toggle.textContent = room?.is_live ? "Encerrar transmissão" : "Iniciar transmissão";
        invite.value = room ? inviteUrl(room.invite_code) : "";
        copy.disabled = !room?.is_live;
    }

    function attachChannel() {
        if (channel) client.removeChannel(channel);
        channel = room ? client.channel(`real-tabletop:${room.invite_code}`).subscribe() : null;
    }

    async function loadRoom() {
        if (!user) return;
        const { data, error } = await client.from("tabletop_rooms")
            .select("id,invite_code,is_live,published_at")
            .eq("owner_id", user.id)
            .eq("campaign_key", master.campaignKey)
            .maybeSingle();
        if (error) throw error;
        room = data;
        attachChannel();
        showState();
        say(room?.is_live ? "Mesa ao vivo. Os jogadores veem apenas a área publicada." : "Mesa local pronta. Inicie a transmissão para criar um convite.");
    }

    async function setUser(nextUser) {
        clearTimeout(publishTimer);
        user = nextUser;
        room = null;
        if (channel) { client.removeChannel(channel); channel = null; }
        showState();
        if (!user) { say("Entre com a conta do mestre para compartilhar a mesa."); return; }
        say("Carregando sua sala…");
        try { await loadRoom(); }
        catch { say("Não foi possível abrir a sala online. Tente novamente."); }
    }

    async function sendChanged() {
        if (!channel) return;
        try { await channel.send({ type: "broadcast", event: "changed", payload: {} }); }
        catch { /* O jogador também consulta a sala periodicamente. */ }
    }

    async function publish() {
        if (!user) return;
        if (publishing) { publishAgain = true; return; }
        publishing = true;
        toggle.disabled = true;
        try {
            await master.ready;
            const frame = master.capturePlayerFrame();
            if (frame.length > 1000000) throw new Error("A imagem publicada ficou grande demais.");
            const changes = { published_frame: frame, is_live: true, published_at: new Date().toISOString() };
            let result;
            if (room) {
                result = await client.from("tabletop_rooms").update(changes)
                    .eq("id", room.id).select("id,invite_code,is_live,published_at").single();
            } else {
                result = await client.from("tabletop_rooms").insert({
                    ...changes, owner_id: user.id, campaign_key: master.campaignKey
                }).select("id,invite_code,is_live,published_at").single();
            }
            if (result.error) throw result.error;
            const previousCode = room?.invite_code;
            room = result.data;
            if (room.invite_code !== previousCode) attachChannel();
            showState();
            say(location.protocol === "file:"
                ? "Ao vivo. Este link local só funciona neste computador; abra o site publicado para convidar outras pessoas."
                : "Ao vivo. Compartilhe o convite com os jogadores.");
            await sendChanged();
        } catch (error) {
            say(error.message === "A imagem publicada ficou grande demais."
                ? error.message : "Não foi possível publicar a visão. A mesa local continua salva.");
        } finally {
            publishing = false;
            toggle.disabled = false;
            if (publishAgain && room?.is_live) {
                publishAgain = false;
                queuePublish();
            }
        }
    }

    function queuePublish() {
        if (!room?.is_live || !user) return;
        clearTimeout(publishTimer);
        publishTimer = setTimeout(publish, 750);
    }

    async function stop() {
        if (!room || !user) return;
        clearTimeout(publishTimer);
        toggle.disabled = true;
        try {
            const { data, error } = await client.from("tabletop_rooms")
                .update({ is_live: false, published_frame: null, published_at: new Date().toISOString() })
                .eq("id", room.id).select("id,invite_code,is_live,published_at").single();
            if (error) throw error;
            room = data;
            showState();
            say("Transmissão encerrada. A mesa continua salva neste navegador.");
            await sendChanged();
        } catch { say("Não foi possível encerrar a transmissão. Tente novamente."); }
        finally { toggle.disabled = false; }
    }

    async function authenticate(createAccount) {
        if (!authForm.reportValidity()) return;
        const email = $("onlineEmail").value.trim();
        const password = $("onlinePassword").value;
        $("onlineSignIn").disabled = $("onlineSignUp").disabled = true;
        say(createAccount ? "Criando conta…" : "Entrando…");
        try {
            const { data, error } = createAccount
                ? await client.auth.signUp({ email, password })
                : await client.auth.signInWithPassword({ email, password });
            if (error) throw error;
            $("onlinePassword").value = "";
            if (!data.session) {
                say("Confira seu e-mail para confirmar a conta e depois entre aqui.");
            } else await setUser(data.user);
        } catch {
            say(createAccount ? "Não foi possível criar a conta. Confira o e-mail e a senha." : "Não foi possível entrar. Confira o e-mail e a senha.");
        } finally { $("onlineSignIn").disabled = $("onlineSignUp").disabled = false; }
    }

    if (!config || !window.supabase?.createClient || !master) {
        say("A conexão online não carregou. A mesa local continua disponível.");
        return;
    }
    client = window.supabase.createClient(config.url, config.publishableKey);
    authForm.addEventListener("submit", (event) => { event.preventDefault(); authenticate(false); });
    $("onlineSignUp").addEventListener("click", () => authenticate(true));
    $("onlineSignOut").addEventListener("click", async () => {
        const { error } = await client.auth.signOut();
        if (error) { say("Não foi possível sair da conta."); return; }
        await setUser(null);
    });
    toggle.addEventListener("click", () => room?.is_live ? stop() : publish());
    copy.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(invite.value);
            say(location.protocol === "file:"
                ? "Link local copiado. Para convidar outro computador, abra a mesa pelo site publicado e copie o link de lá."
                : "Convite copiado. Quem tiver esse link poderá assistir à área publicada.");
        } catch {
            invite.select();
            say("Selecione e copie o convite mostrado acima.");
        }
    });
    window.addEventListener("real:tabletop-changed", queuePublish);
    client.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") setUser(null);
        else if (event === "SIGNED_IN" && session?.user?.id !== user?.id) {
            setTimeout(() => { if (session.user.id !== user?.id) setUser(session.user); }, 0);
        }
    });
    client.auth.getUser().then(({ data }) => setUser(data.user || null))
        .catch(() => setUser(null));
})();
