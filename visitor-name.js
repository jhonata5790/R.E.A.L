// Nome local do visitante; apenas a presença temporária da mesa o compartilha.
(function () {
    "use strict";

    const storageKey = "real:visitor-name";
    const normalize = (value) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 32) : "";
    let name = "";
    try { name = normalize(localStorage.getItem(storageKey)); } catch { /* Navegação privada pode bloquear armazenamento. */ }
    if (name.length < 2) name = "";
    let resolveReady;
    const ready = new Promise((resolve) => { resolveReady = resolve; });
    if (name) resolveReady(name);

    function save(value) {
        const next = normalize(value);
        if (next.length < 2) return false;
        name = next;
        try { localStorage.setItem(storageKey, name); } catch { /* Mantém o nome nesta visita. */ }
        resolveReady(name);
        window.dispatchEvent(new CustomEvent("real:visitor-name-changed", { detail: { name } }));
        return true;
    }

    window.REAL_VISITOR_NAME = { ready, getName: () => name, edit: () => openDialog() };

    let dialog;
    let input;
    function openDialog() {
        if (!dialog) return;
        input.value = name;
        dialog.showModal();
        input.focus();
    }

    function init() {
        dialog = document.createElement("dialog");
        dialog.className = "real-visitor-dialog";
        dialog.setAttribute("aria-labelledby", "realVisitorTitle");
        dialog.innerHTML = '<form method="dialog" class="real-visitor-dialog__form">' +
            '<span class="real-visitor-dialog__eyebrow">R.E.A.L · BEM-VINDO</span>' +
            '<h2 id="realVisitorTitle">Como podemos te chamar?</h2>' +
            '<p>Seu nome ficará salvo somente neste navegador. Na mesa, o mestre poderá ver quem está assistindo.</p>' +
            '<label for="realVisitorInput">Seu nome</label>' +
            '<input id="realVisitorInput" name="visitorName" type="text" minlength="2" maxlength="32" autocomplete="nickname" required>' +
            '<button type="submit">Continuar</button></form>';
        document.body.appendChild(dialog);
        input = dialog.querySelector("input");
        dialog.querySelector("form").addEventListener("submit", (event) => {
            event.preventDefault();
            if (!save(input.value)) { input.setCustomValidity("Digite pelo menos 2 caracteres."); input.reportValidity(); return; }
            dialog.close();
            document.body.classList.remove("real-visitor-required");
            editButton.textContent = `Seu nome: ${name} · alterar`;
        });
        input.addEventListener("input", () => input.setCustomValidity(""));
        dialog.addEventListener("cancel", (event) => { if (!name) event.preventDefault(); });

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "real-visitor-edit";
        editButton.textContent = `Seu nome: ${name} · alterar`;
        editButton.addEventListener("click", openDialog);
        document.body.appendChild(editButton);
        if (!name) {
            document.body.classList.add("real-visitor-required");
            openDialog();
        }
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
})();
