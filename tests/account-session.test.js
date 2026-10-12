const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const rules = require('../assets/js/shared/account-library.js');
const source = fs.readFileSync(path.join(__dirname, '../assets/js/shared/account.js'), 'utf8');

async function initialize(error) {
    const nodes = new Map(), events = [], errors = [], storage = new Map();
    const node = (id) => {
        if (!nodes.has(id)) nodes.set(id, {
            hidden: false, dataset: {}, classList: { toggle() {} }, textContent: '',
            addEventListener() {}, appendChild() {}, querySelector: (selector) => node(id + selector)
        });
        return nodes.get(id);
    };
    let authChanged;
    const client = { auth: {
        onAuthStateChange(callback) { authChanged = callback; },
        async getUser() { return { data: { user: null }, error }; }
    } };
    const window = { REAL_ACCOUNT_LIBRARY: rules, REAL_SUPABASE_CONFIG: { url: 'https://example.invalid', publishableKey: 'public-test' },
        supabase: { createClient: () => client }, addEventListener() {}, dispatchEvent: (event) => events.push(event.type) };
    vm.runInNewContext(source, {
        window, document: { body: { insertAdjacentHTML() {} }, getElementById: node, querySelectorAll: () => [] },
        localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
        Event, setTimeout: (callback) => { callback(); return 1; }, clearTimeout() {},
        location: { reload() {}, protocol: 'https:', origin: 'https://example.invalid', pathname: '/' },
        console: { error: (...items) => errors.push(items) }
    });
    await window.REAL_ACCOUNT.ready;
    return { window, events, errors, authChanged };
}

(async () => {
    const local = await initialize({ name: 'AuthSessionMissingError', message: 'Auth session missing!' });
    assert.equal(local.errors.length, 0, 'usar mesas locais sem login não é erro de inicialização');
    assert.equal(local.window.REAL_ACCOUNT.isSignedIn(), false);
    assert.ok(local.events.includes('real:account-changed'));
    local.authChanged('SIGNED_OUT', null);
    assert.equal(local.events.filter((name) => name === 'real:account-changed').length, 2, 'a sala recebe a saída da conta');
    const failure = await initialize({ name: 'AuthApiError', message: 'Falha de rede' });
    assert.equal(failure.errors.length, 1, 'outras falhas continuam sendo reportadas');
    assert.equal(failure.window.REAL_ACCOUNT.isSignedIn(), false);
    console.log('Conta: acesso local sem sessão e atualização após sair: OK');
})().catch((error) => { console.error(error); process.exitCode = 1; });
