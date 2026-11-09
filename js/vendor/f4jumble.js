import { blake2b } from './blake2b.js';
import { bech32m } from './bech32.js';

function xor(a, b) {
    const len = Math.min(a.length, b.length);
    const result = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        result[i] = a[i] ^ b[i];
    }
    return result;
}

const H_BASE = new Uint8Array([85, 65, 95, 70, 52, 74, 117, 109, 98, 108, 101, 95, 72]); // "UA_F4Jumble_H" (13 bytes)
const G_BASE = new Uint8Array([85, 65, 95, 70, 52, 74, 117, 109, 98, 108, 101, 95, 71]); // "UA_F4Jumble_G" (13 bytes)

function H_func(i, u, l_L) {
    const personal = new Uint8Array(16);
    personal.set(H_BASE, 0);
    personal[13] = i;
    personal[14] = 0;
    personal[15] = 0;
    return blake2b(u, null, l_L, null, personal);
}

function G_func(i, u, l_R) {
    const blocksCount = Math.ceil(l_R / 64);
    const result = new Uint8Array(blocksCount * 64);
    for (let j = 0; j < blocksCount; j++) {
        const personal = new Uint8Array(16);
        personal.set(G_BASE, 0);
        personal[13] = i;
        personal[14] = j & 0xff;
        personal[15] = (j >> 8) & 0xff;
        const block = blake2b(u, null, 64, null, personal);
        result.set(block, j * 64);
    }
    return result.slice(0, l_R);
}

export function f4jumble(M) {
    const l_M = M.length;
    if (l_M < 38) throw new Error("F4Jumble input too short");
    const l_H = 64;
    const l_L = Math.min(l_H, Math.floor(l_M / 2));
    const l_R = l_M - l_L;

    const a = M.slice(0, l_L);
    const b = M.slice(l_L);

    const x = xor(b, G_func(0, a, l_R));
    const y = xor(a, H_func(0, x, l_L));
    const d = xor(x, G_func(1, y, l_R));
    const c = xor(y, H_func(1, d, l_L));

    const result = new Uint8Array(l_M);
    result.set(c, 0);
    result.set(d, l_L);
    return result;
}

export function f4jumble_inv(C) {
    const l_M = C.length;
    if (l_M < 38) throw new Error("F4Jumble ciphertext too short");
    const l_H = 64;
    const l_L = Math.min(l_H, Math.floor(l_M / 2));
    const l_R = l_M - l_L;

    const c = C.slice(0, l_L);
    const d = C.slice(l_L);

    const y = xor(c, H_func(1, d, l_L));
    const x = xor(d, G_func(1, y, l_R));
    const a = xor(y, H_func(0, x, l_L));
    const b = xor(x, G_func(0, a, l_R));

    const result = new Uint8Array(l_M);
    result.set(a, 0);
    result.set(b, l_L);
    return result;
}

export function decodeUnifiedAddress(addrStr) {
    if (!addrStr || typeof addrStr !== 'string') return null;
    const trimmed = addrStr.trim();
    // Bech32/Bech32m strings must not mix cases; check before lowercasing so the
    // underlying decoder's own mixed-case guard isn't bypassed.
    if (/[a-z]/.test(trimmed) && /[A-Z]/.test(trimmed)) return null;
    const addr = trimmed.toLowerCase();

    let pos = addr.lastIndexOf('1');
    if (pos < 1) return null;
    const hrp = addr.slice(0, pos);
    if (hrp !== 'u' && hrp !== 'utest') return null;

    try {
        const decoded = bech32m.decode(addr, 1024);
        if (decoded.prefix !== hrp) return null;
        
        const payload = bech32m.fromWords(decoded.words);
        if (payload.length < 38) return null;
        
        // Unjumble
        const unjumbled = f4jumble_inv(payload);
        
        // Validate HRP padding at the end of the unjumbled payload
        const expectedPadding = new Uint8Array(16);
        for (let i = 0; i < hrp.length; i++) {
            expectedPadding[i] = hrp.charCodeAt(i);
        }
        
        const paddingOffset = unjumbled.length - 16;
        for (let i = 0; i < 16; i++) {
            if (unjumbled[paddingOffset + i] !== expectedPadding[i]) {
                return null; // Invalid HRP padding
            }
        }
        
        // Strip the padding
        const receiversBytes = unjumbled.slice(0, paddingOffset);
        
        // Parse the receivers
        const receivers = [];
        let idx = 0;
        while (idx < receiversBytes.length) {
            if (idx + 2 > receiversBytes.length) return null; // Malformed receiver header
            const typecode = receiversBytes[idx++];
            const length = receiversBytes[idx++];
            if (length === 0) return null; // A receiver cannot carry zero bytes of key material
            if (idx + length > receiversBytes.length) return null; // Malformed receiver body
            const value = receiversBytes.slice(idx, idx + length);
            idx += length;
            receivers.push({ typecode, length, value });
        }
        return receivers;
    } catch (e) {
        return null;
    }
}
