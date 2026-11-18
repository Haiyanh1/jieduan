/**
 * 导出用轻量加解密（密码保护 JSON）
 * 优先 Web Crypto AES-GCM；不可用时回退 XOR+SHA256（仍需密码才能还原）
 */

function bytesToBase64(bytes) {
	const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
	let binary = ''
	for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i])
	if (typeof btoa === 'function') return btoa(binary)
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
	let out = ''
	for (let i = 0; i < arr.length; i += 3) {
		const a = arr[i]
		const b = i + 1 < arr.length ? arr[i + 1] : 0
		const c = i + 2 < arr.length ? arr[i + 2] : 0
		const triple = (a << 16) | (b << 8) | c
		out += chars[(triple >> 18) & 63]
		out += chars[(triple >> 12) & 63]
		out += i + 1 < arr.length ? chars[(triple >> 6) & 63] : '='
		out += i + 2 < arr.length ? chars[triple & 63] : '='
	}
	return out
}

function base64ToBytes(b64) {
	const str = String(b64 || '')
	if (typeof atob === 'function') {
		const binary = atob(str)
		const out = new Uint8Array(binary.length)
		for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
		return out
	}
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
	const clean = str.replace(/=+$/, '')
	const out = []
	for (let i = 0; i < clean.length; i += 4) {
		const a = chars.indexOf(clean[i])
		const b = chars.indexOf(clean[i + 1])
		const c = chars.indexOf(clean[i + 2])
		const d = chars.indexOf(clean[i + 3])
		out.push((a << 2) | (b >> 4))
		if (clean[i + 2] != null) out.push(((b & 15) << 4) | (c >> 2))
		if (clean[i + 3] != null) out.push(((c & 3) << 6) | d)
	}
	return new Uint8Array(out)
}

function randomBytes(len) {
	const out = new Uint8Array(len)
	if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
		crypto.getRandomValues(out)
		return out
	}
	for (let i = 0; i < len; i++) out[i] = Math.floor(Math.random() * 256)
	return out
}

/** 极简 SHA-256（同步，用于无 subtle 回退） */
function sha256Bytes(messageBytes) {
	// 使用 TextEncoder
	const K = new Uint32Array([
		0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
		0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
		0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
		0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
		0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
		0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
		0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
		0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
	])
	function rotr(n, x) { return (x >>> n) | (x << (32 - n)) }
	const msg = messageBytes
	const l = msg.length
	const bitLen = l * 8
	const withOne = new Uint8Array(((l + 9 + 63) >> 6) << 6)
	withOne.set(msg)
	withOne[l] = 0x80
	const view = new DataView(withOne.buffer)
	view.setUint32(withOne.length - 4, bitLen >>> 0)
	view.setUint32(withOne.length - 8, Math.floor(bitLen / 0x100000000))

	let h0 = 0x6a09e667
	let h1 = 0xbb67ae85
	let h2 = 0x3c6ef372
	let h3 = 0xa54ff53a
	let h4 = 0x510e527f
	let h5 = 0x9b05688c
	let h6 = 0x1f83d9ab
	let h7 = 0x5be0cd19
	const w = new Uint32Array(64)

	for (let i = 0; i < withOne.length; i += 64) {
		for (let j = 0; j < 16; j++) w[j] = view.getUint32(i + j * 4)
		for (let j = 16; j < 64; j++) {
			const s0 = rotr(7, w[j - 15]) ^ rotr(18, w[j - 15]) ^ (w[j - 15] >>> 3)
			const s1 = rotr(17, w[j - 2]) ^ rotr(19, w[j - 2]) ^ (w[j - 2] >>> 10)
			w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0
		}
		let a = h0
		let b = h1
		let c = h2
		let d = h3
		let e = h4
		let f = h5
		let g = h6
		let h = h7
		for (let j = 0; j < 64; j++) {
			const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e)
			const ch = (e & f) ^ (~e & g)
			const t1 = (h + S1 + ch + K[j] + w[j]) >>> 0
			const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a)
			const maj = (a & b) ^ (a & c) ^ (b & c)
			const t2 = (S0 + maj) >>> 0
			h = g
			g = f
			f = e
			e = (d + t1) >>> 0
			d = c
			c = b
			b = a
			a = (t1 + t2) >>> 0
		}
		h0 = (h0 + a) >>> 0
		h1 = (h1 + b) >>> 0
		h2 = (h2 + c) >>> 0
		h3 = (h3 + d) >>> 0
		h4 = (h4 + e) >>> 0
		h5 = (h5 + f) >>> 0
		h6 = (h6 + g) >>> 0
		h7 = (h7 + h) >>> 0
	}
	const out = new Uint8Array(32)
	const dv = new DataView(out.buffer)
	dv.setUint32(0, h0)
	dv.setUint32(4, h1)
	dv.setUint32(8, h2)
	dv.setUint32(12, h3)
	dv.setUint32(16, h4)
	dv.setUint32(20, h5)
	dv.setUint32(24, h6)
	dv.setUint32(28, h7)
	return out
}

function utf8Encode(str) {
	if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str)
	const utf8 = unescape(encodeURIComponent(str))
	const out = new Uint8Array(utf8.length)
	for (let i = 0; i < utf8.length; i++) out[i] = utf8.charCodeAt(i)
	return out
}

function utf8Decode(bytes) {
	if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes)
	let s = ''
	for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
	try {
		return decodeURIComponent(escape(s))
	} catch (e) {
		return s
	}
}

function hasSubtle() {
	return typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.encrypt === 'function'
}

async function encryptAesGcm(plainText, password) {
	const enc = utf8Encode(plainText)
	const salt = randomBytes(16)
	const iv = randomBytes(12)
	const keyMaterial = await crypto.subtle.importKey('raw', utf8Encode(password), 'PBKDF2', false, ['deriveKey'])
	const key = await crypto.subtle.deriveKey(
		{ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
		keyMaterial,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt']
	)
	const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc)
	return {
		app: 'jieduan',
		version: 1,
		encrypted: true,
		alg: 'AES-GCM-PBKDF2',
		salt: bytesToBase64(salt),
		iv: bytesToBase64(iv),
		data: bytesToBase64(new Uint8Array(cipherBuf)),
		exportedAt: new Date().toISOString()
	}
}

async function decryptAesGcm(payload, password) {
	const salt = base64ToBytes(payload.salt)
	const iv = base64ToBytes(payload.iv)
	const data = base64ToBytes(payload.data)
	const keyMaterial = await crypto.subtle.importKey('raw', utf8Encode(password), 'PBKDF2', false, ['deriveKey'])
	const key = await crypto.subtle.deriveKey(
		{ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
		keyMaterial,
		{ name: 'AES-GCM', length: 256 },
		false,
		['decrypt']
	)
	const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
	return utf8Decode(new Uint8Array(plainBuf))
}

function deriveXorKey(password, salt, length) {
	const out = new Uint8Array(length)
	let block = sha256Bytes(utf8Encode(`${password}:${bytesToBase64(salt)}:0`))
	let offset = 0
	let round = 0
	while (offset < length) {
		if (round > 0) block = sha256Bytes(utf8Encode(`${password}:${bytesToBase64(salt)}:${round}`))
		const n = Math.min(32, length - offset)
		out.set(block.subarray(0, n), offset)
		offset += n
		round += 1
	}
	return out
}

function encryptXor(plainText, password) {
	const salt = randomBytes(16)
	const plain = utf8Encode(plainText)
	const key = deriveXorKey(password, salt, plain.length)
	const out = new Uint8Array(plain.length)
	for (let i = 0; i < plain.length; i++) out[i] = plain[i] ^ key[i]
	return {
		app: 'jieduan',
		version: 1,
		encrypted: true,
		alg: 'XOR-SHA256',
		salt: bytesToBase64(salt),
		data: bytesToBase64(out),
		exportedAt: new Date().toISOString()
	}
}

function decryptXor(payload, password) {
	const salt = base64ToBytes(payload.salt)
	const data = base64ToBytes(payload.data)
	const key = deriveXorKey(password, salt, data.length)
	const out = new Uint8Array(data.length)
	for (let i = 0; i < data.length; i++) out[i] = data[i] ^ key[i]
	return utf8Decode(out)
}

export function isEncryptedExport(raw) {
	let data = raw
	if (typeof raw === 'string') {
		try {
			data = JSON.parse(raw)
		} catch (e) {
			return false
		}
	}
	return !!(data && data.encrypted && data.app === 'jieduan' && data.data)
}

export async function encryptPayloadJson(jsonText, password) {
	const pwd = String(password || '')
	if (!pwd) throw new Error('密码不能为空')
	if (hasSubtle()) {
		try {
			return await encryptAesGcm(jsonText, pwd)
		} catch (e) {
			console.warn('AES encrypt fallback', e)
		}
	}
	return encryptXor(jsonText, pwd)
}

export async function decryptPayloadToJson(raw, password) {
	const pwd = String(password || '')
	if (!pwd) throw new Error('请输入密码')
	let payload = raw
	if (typeof raw === 'string') payload = JSON.parse(raw)
	if (!isEncryptedExport(payload)) throw new Error('不是加密导出文件')

	if (payload.alg === 'AES-GCM-PBKDF2' && hasSubtle()) {
		try {
			return await decryptAesGcm(payload, pwd)
		} catch (e) {
			throw new Error('密码错误或文件损坏')
		}
	}
	try {
		const text = decryptXor(payload, pwd)
		JSON.parse(text)
		return text
	} catch (e) {
		throw new Error('密码错误或文件损坏')
	}
}
