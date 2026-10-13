-- Guarda somente a chave PUBLICA da sessão. O dono continua protegido pelas políticas existentes.
-- Permissões, pedidos e pontos são efêmeros: nenhuma chave privada ou posição é persistida.
alter table public.tabletop_rooms add column if not exists pointer_authority jsonb;
alter table public.tabletop_rooms add constraint tabletop_pointer_public_authority check (
    (pointer_authority is null or (
        jsonb_typeof(pointer_authority) = 'object'
        and (pointer_authority - 'sessionId' - 'publicKey') = '{}'::jsonb
        and (pointer_authority ->> 'sessionId') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        and jsonb_typeof(pointer_authority -> 'publicKey') = 'object'
        and (pointer_authority -> 'publicKey' ->> 'kty') = 'EC'
        and (pointer_authority -> 'publicKey' ->> 'crv') = 'P-256'
        and (pointer_authority -> 'publicKey' ->> 'x') ~ '^[A-Za-z0-9_-]{43}$'
        and (pointer_authority -> 'publicKey' ->> 'y') ~ '^[A-Za-z0-9_-]{43}$'
        and ((pointer_authority -> 'publicKey') - 'kty' - 'crv' - 'x' - 'y' - 'ext') = '{}'::jsonb
        and octet_length(pointer_authority::text) < 1024
    )) is true
);
