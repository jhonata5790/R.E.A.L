// Conta R.E.A.L: autenticação e sincronização da biblioteca local com Supabase.
(function () {
    "use strict";

    const STORAGE_KEY = "cronicas-biblioteca-v2";
    const GUEST_KEY = STORAGE_KEY + ":guest";
    const USER_CACHE_PREFIX = STORAGE_KEY + ":user:";
    const RULES = window.REAL_ACCOUNT_LIBRARY;
    const config = window.REAL_SUPABASE_CONFIG;
    let client = null;
    let user = null;
    let syncTimer = null;
    let syncing = false;
    let syncQueued = false;
    let recoveringPassword = false;

    const api = window.REAL_ACCOUNT = {
        ready: Promise.resolve(null),
        isSignedIn: () => Boolean(user),
        currentUser: () => user,
        markLibraryDirty,
        libraryChanged: queueSync,
        syncNow: () => syncLibrary()
    };

    function readLibrary(key = STORAGE_KEY) {
        try { return RULES.normalize(JSON.parse(localStorage.getItem(key) || "null")); }
        catch { return RULES.normalize(); }
    }

    function writeLibrary(library, key = STORAGE_KEY) {
        localStorage.setItem(key, JSON.stringify(RULES.normalize(library)));
    }

    function markLibraryDirty(library) {
        if (!library || typeof library !== "object") return library;
        const previous = library._account && typeof library._account === "object" ? library._account : {};
        library._account = {
            ...previous,
            userId: user?.id || previous.userId || null,
            localUpdatedAt: new Date().toISOString()
        };
        return library;
    }

    function stampSynced(payload, updatedAt) {
        const library = RULES.normalize(payload);
        library._account = {
            userId: user.id,
            localUpdatedAt: updatedAt,
            lastSyncedAt: updatedAt
        };
        writeLibrary(library);
        writeLibrary(library, USER_CACHE_PREFIX + user.id);
        return library;
    }

    function hasPersonalData(library) {
        return library.characters.length > 0 || library.homebrew.length > 0 || library.campaigns.some((campaign) => campaign?.id !== "campanha-inicial"
            || campaign?.name !== "Minha campanha" || campaign?.description !== "Sua próxima aventura começa aqui."
            || campaign?.notes || campaign?.characters?.length);
    }

    function setMessage(message, tone = "") {
        const node = document.getElementById("realAccountMessage");
        if (node) {
            node.textContent = message;
            node.dataset.tone = tone;
        }
    }

    function setStorageStatus(message) {
        document.querySelectorAll("[data-account-storage-status]").forEach((node) => { node.textContent = message; });
    }

    function setSyncState(message) {
        const node = document.getElementById("realAccountSyncState");
        if (node) node.textContent = message;
        if (user) setStorageStatus(message);
    }

    async function uploadLibrary(library) {
        const updatedAt = new Date().toISOString();
        const { data, error } = await client.from("user_libraries").upsert({
            owner_id: user.id,
            payload: RULES.clean(library),
            updated_at: updatedAt
        }, { onConflict: "owner_id" }).select("payload,updated_at").single();
        if (error) throw error;
        stampSynced(data.payload, data.updated_at);
        return data;
    }

    async function syncLibrary(options = {}) {
        if (!client || !user) return false;
        if (syncing) { syncQueued = true; return false; }
        syncing = true;
        setSyncState("Sincronizando com sua conta…");
        let shouldReload = false;
        try {
            const local = readLibrary();
            const { data: remote, error } = await client.from("user_libraries")
                .select("payload,updated_at").eq("owner_id", user.id).maybeSingle();
            if (error) throw error;
            if (!remote) {
                await uploadLibrary(local);
            } else {
                const action = options.preferRemote ? "download" : RULES.decision(local, remote.updated_at, user.id);
                if (action === "download") {
                    const before = JSON.stringify(RULES.clean(local));
                    const after = JSON.stringify(RULES.clean(remote.payload));
                    stampSynced(remote.payload, remote.updated_at);
                    shouldReload = before !== after;
                } else if (action === "merge") {
                    await uploadLibrary(RULES.merge(remote.payload, local));
                    shouldReload = true;
                } else if (action === "upload") {
                    await uploadLibrary(local);
                } else {
                    stampSynced(local, remote.updated_at);
                }
            }
            setSyncState("Tudo salvo na sua conta");
            renderAccount();
            if (shouldReload && options.reload !== false) location.reload();
            return true;
        } catch (error) {
            console.error("Falha ao sincronizar a biblioteca", error);
            setSyncState("Salvo neste aparelho · sincronização pendente");
            setMessage("Não foi possível sincronizar agora. Seus dados continuam seguros neste aparelho.", "error");
            return false;
        } finally {
            syncing = false;
            if (syncQueued) {
                syncQueued = false;
                setTimeout(() => syncLibrary({ reload: false }), 0);
            }
        }
    }

    function queueSync() {
        if (!user) return;
        clearTimeout(syncTimer);
        setSyncState("Alterações aguardando sincronização…");
        syncTimer = setTimeout(() => syncLibrary({ reload: false }), 450);
    }

    function renderAccount() {
        const button = document.getElementById("realAccountButton");
        const signedOut = document.getElementById("realAccountSignedOut");
        const signedIn = document.getElementById("realAccountSignedIn");
        const recovery = document.getElementById("realAccountRecovery");
        if (!button || !signedOut || !signedIn || !recovery) return;
        signedOut.hidden = Boolean(user) || recoveringPassword;
        signedIn.hidden = !user || recoveringPassword;
        recovery.hidden = !recoveringPassword;
        button.classList.toggle("is-signed-in", Boolean(user));
        button.querySelector("strong").textContent = user ? "Minha conta" : "Entrar ou criar conta";
        button.querySelector("small").textContent = user ? user.email : "Sincronize sua biblioteca";
        const email = document.getElementById("realAccountEmailValue");
        if (email) email.textContent = user?.email || "";
        if (!user) setStorageStatus("Seus dados estão salvos neste navegador");
    }

    function openDialog() {
        const dialog = document.getElementById("realAccountDialog");
        renderAccount();
        setMessage("");
        if (!dialog.open) dialog.showModal();
    }

    function redirectUrl() {
        if (!/^https?:$/.test(location.protocol)) return undefined;
        return location.origin + location.pathname;
    }

    async function authenticate(createAccount) {
        const form = document.getElementById("realAccountAuthForm");
        if (!form.reportValidity() || !client) return;
        const formData = new FormData(form);
        const email = String(formData.get("email") || "").trim();
        const password = String(formData.get("password") || "");
        const name = String(formData.get("name") || "").trim();
        form.querySelectorAll("button").forEach((button) => { button.disabled = true; });
        setMessage(createAccount ? "Criando sua conta…" : "Entrando…");
        try {
            const result = createAccount
                ? await client.auth.signUp({ email, password, options: { data: { display_name: name } } })
                : await client.auth.signInWithPassword({ email, password });
            if (result.error) throw result.error;
            form.elements.password.value = "";
            if (!result.data.session) {
                setMessage("Conta criada. Confira seu e-mail para confirmar o cadastro.", "success");
            } else {
                await setUser(result.data.user, { preserveGuest: true });
                setMessage("Conta conectada e biblioteca sincronizada.", "success");
            }
        } catch (error) {
            console.error("Falha na autenticação", error);
            setMessage(createAccount ? "Não foi possível criar a conta. Confira os dados e tente novamente." : "E-mail ou senha incorretos.", "error");
        } finally {
            form.querySelectorAll("button").forEach((button) => { button.disabled = false; });
        }
    }

    async function requestPasswordReset() {
        if (!client) return;
        const email = document.getElementById("realAccountEmail").value.trim();
        if (!email) {
            setMessage("Digite seu e-mail primeiro.", "error");
            document.getElementById("realAccountEmail").focus();
            return;
        }
        setMessage("Enviando o link de recuperação…");
        const options = redirectUrl() ? { redirectTo: redirectUrl() } : undefined;
        const { error } = await client.auth.resetPasswordForEmail(email, options);
        setMessage(error ? "Não foi possível enviar o link agora." : "Link enviado. Confira seu e-mail.", error ? "error" : "success");
    }

    async function updatePassword(event) {
        event.preventDefault();
        const form = event.currentTarget;
        if (!form.reportValidity()) return;
        const password = form.elements.newPassword.value;
        const confirmation = form.elements.confirmPassword.value;
        if (password !== confirmation) { setMessage("As senhas não são iguais.", "error"); return; }
        const { error } = await client.auth.updateUser({ password });
        if (error) { setMessage("Não foi possível atualizar a senha.", "error"); return; }
        recoveringPassword = false;
        form.reset();
        renderAccount();
        setMessage("Senha atualizada com sucesso.", "success");
    }

    async function setUser(nextUser, options = {}) {
        const previousId = user?.id || null;
        user = nextUser || null;
        if (!user) { renderAccount(); return; }
        const local = readLibrary();
        if (options.preserveGuest && !local._account?.userId && hasPersonalData(local)) writeLibrary(local, GUEST_KEY);
        renderAccount();
        if (previousId !== user.id || options.forceSync) await syncLibrary();
    }

    function restoreGuestLibrary() {
        const current = localStorage.getItem(STORAGE_KEY);
        const guest = localStorage.getItem(GUEST_KEY);
        if (guest) localStorage.setItem(STORAGE_KEY, guest);
        else localStorage.removeItem(STORAGE_KEY);
        return current !== (guest || null);
    }

    async function signOut() {
        if (!client || !user) return;
        await syncLibrary({ reload: false });
        const { error } = await client.auth.signOut();
        if (error) { setMessage("Não foi possível sair da conta.", "error"); return; }
        user = null;
        restoreGuestLibrary();
        location.reload();
    }

    function createInterface() {
        document.body.insertAdjacentHTML("beforeend", `
            <button id="realAccountButton" class="real-account-button" type="button" aria-haspopup="dialog">
                <span aria-hidden="true">♙</span><span><strong>Entrar ou criar conta</strong><small>Sincronize sua biblioteca</small></span>
            </button>
            <dialog id="realAccountDialog" class="real-account-dialog" aria-labelledby="realAccountTitle">
                <button id="realAccountClose" class="real-account-close" type="button" aria-label="Fechar">×</button>
                <div class="real-account-brand"><span aria-hidden="true">✦</span><div><small>R.E.A.L</small><h2 id="realAccountTitle">Sua biblioteca, em qualquer lugar</h2></div></div>
                <section id="realAccountSignedOut">
                    <p>Entre para guardar personagens, campanhas e homebrews na sua conta. O que já está neste navegador será preservado.</p>
                    <form id="realAccountAuthForm" class="real-account-form">
                        <label>Nome <small>(usado ao criar a conta)</small><input name="name" autocomplete="name" maxlength="80"></label>
                        <label>E-mail<input id="realAccountEmail" name="email" type="email" autocomplete="email" required></label>
                        <label>Senha<input name="password" type="password" autocomplete="current-password" minlength="8" required></label>
                        <div class="real-account-actions"><button class="real-account-primary" type="submit">Entrar</button><button id="realAccountSignUp" type="button">Criar conta</button></div>
                        <button id="realAccountForgot" class="real-account-link" type="button">Esqueci minha senha</button>
                    </form>
                </section>
                <section id="realAccountSignedIn" hidden>
                    <p class="real-account-kicker">CONTA CONECTADA</p>
                    <strong id="realAccountEmailValue" class="real-account-email"></strong>
                    <p id="realAccountSyncState">Tudo salvo na sua conta</p>
                    <div class="real-account-benefits"><span>✓ Personagens</span><span>✓ Campanhas</span><span>✓ Homebrews</span></div>
                    <button id="realAccountSyncNow" class="real-account-primary" type="button">Sincronizar agora</button>
                    <button id="realAccountSignOut" class="real-account-link" type="button">Sair desta conta</button>
                </section>
                <section id="realAccountRecovery" hidden>
                    <p>Escolha uma nova senha para sua conta.</p>
                    <form id="realAccountRecoveryForm" class="real-account-form">
                        <label>Nova senha<input name="newPassword" type="password" minlength="8" autocomplete="new-password" required></label>
                        <label>Confirmar senha<input name="confirmPassword" type="password" minlength="8" autocomplete="new-password" required></label>
                        <button class="real-account-primary" type="submit">Atualizar senha</button>
                    </form>
                </section>
                <p id="realAccountMessage" class="real-account-message" role="status" aria-live="polite"></p>
            </dialog>`);
        document.getElementById("realAccountButton").addEventListener("click", openDialog);
        document.getElementById("realAccountClose").addEventListener("click", () => document.getElementById("realAccountDialog").close());
        document.getElementById("realAccountDialog").addEventListener("click", (event) => {
            if (event.target === event.currentTarget) event.currentTarget.close();
        });
        document.getElementById("realAccountAuthForm").addEventListener("submit", (event) => { event.preventDefault(); authenticate(false); });
        document.getElementById("realAccountSignUp").addEventListener("click", () => authenticate(true));
        document.getElementById("realAccountForgot").addEventListener("click", requestPasswordReset);
        document.getElementById("realAccountRecoveryForm").addEventListener("submit", updatePassword);
        document.getElementById("realAccountSyncNow").addEventListener("click", () => syncLibrary({ reload: false }));
        document.getElementById("realAccountSignOut").addEventListener("click", signOut);
        renderAccount();
    }

    async function initialize() {
        createInterface();
        if (!RULES || !config || !window.supabase?.createClient) {
            document.getElementById("realAccountButton").disabled = true;
            setMessage("A conexão de contas não carregou. A biblioteca local continua disponível.", "error");
            return null;
        }
        client = window.supabase.createClient(config.url, config.publishableKey);
        client.auth.onAuthStateChange((event, session) => {
            if (event === "PASSWORD_RECOVERY") {
                recoveringPassword = true;
                user = session?.user || user;
                setTimeout(() => { openDialog(); renderAccount(); }, 0);
            } else if (event === "SIGNED_OUT") {
                user = null;
                setTimeout(renderAccount, 0);
            } else if (event === "SIGNED_IN" && session?.user?.id !== user?.id) {
                setTimeout(() => setUser(session.user, { preserveGuest: true }), 0);
            }
        });
        const { data, error } = await client.auth.getUser();
        if (error) throw error;
        if (!data.user && readLibrary()._account?.userId && restoreGuestLibrary()) {
            location.reload();
            return null;
        }
        await setUser(data.user || null, { forceSync: Boolean(data.user), preserveGuest: Boolean(data.user) });
        return user;
    }

    window.addEventListener("real:library-changed", queueSync);
    window.addEventListener("online", () => { if (user) syncLibrary({ reload: false }); });
    api.ready = initialize().catch((error) => {
        console.error("Não foi possível iniciar a conta R.E.A.L", error);
        setStorageStatus("Seus dados estão salvos neste navegador");
        return null;
    });
})();
