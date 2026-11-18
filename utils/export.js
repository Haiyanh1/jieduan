/**
 * 打卡记录 JSON 导出 / 导入
 * App：写入私有目录并系统分享；浏览器：直接下载 json 文件
 */
import { getCheckins, saveCheckins, flushCheckins } from './storage.js'
import { isApp, isH5, getMainActivity } from './platform.js'
import { encryptPayloadJson, decryptPayloadToJson, isEncryptedExport } from './crypto-lite.js'

const PICK_REQ_CODE = 91087

export function buildCheckinExport() {
	flushCheckins()
	const map = getCheckins() || {}
	const keys = Object.keys(map).sort()
	const checkins = {}
	keys.forEach((key) => {
		const item = map[key] || {}
		let status = item.status
		if (status === 'relapse') status = 'fail'
		if (status !== 'success' && status !== 'fail') return
		checkins[key] = {
			date: key,
			status,
			cigs: status === 'fail' ? (Number(item.cigs) || 1) : 0,
			updatedAt: Number(item.updatedAt) || Date.now()
		}
	})
	const payload = {
		app: 'jieduan',
		version: 1,
		exportedAt: new Date().toISOString(),
		checkins
	}
	return {
		json: JSON.stringify(payload, null, 2),
		payload,
		count: Object.keys(checkins).length,
		fileName: `jieduan-checkins-${new Date().toISOString().slice(0, 10)}.json`
	}
}

/** 把各种可能的 JSON 结构规范成本地 checkins map */
export function normalizeImportedCheckins(raw) {
	let data = raw
	if (typeof raw === 'string') {
		data = JSON.parse(raw)
	}
	if (!data || typeof data !== 'object') {
		throw new Error('JSON 格式不正确')
	}

	let source = null
	if (data.checkins && typeof data.checkins === 'object' && !Array.isArray(data.checkins)) {
		source = data.checkins
	} else if (Array.isArray(data)) {
		source = {}
		data.forEach((item) => {
			const key = item && (item.date || item.key)
			if (key) source[key] = item
		})
	} else {
		const keys = Object.keys(data)
		const looksLikeMap = keys.length && keys.every((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
		if (!looksLikeMap) throw new Error('不是有效的打卡 JSON')
		source = data
	}

	const cleaned = {}
	Object.keys(source).forEach((key) => {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return
		const item = source[key]
		if (!item || typeof item !== 'object') return
		let status = item.status
		if (status === 'relapse') status = 'fail'
		if (status !== 'success' && status !== 'fail') return
		cleaned[key] = {
			date: key,
			status,
			cigs: status === 'fail' ? Math.max(1, Number(item.cigs) || 1) : 0,
			updatedAt: Number(item.updatedAt) || Date.now()
		}
	})
	return cleaned
}

function writeDocFile(fileName, content) {
	return new Promise((resolve, reject) => {
		if (!isApp()) {
			reject(new Error('仅 App 支持写入私有目录'))
			return
		}
		plus.io.requestFileSystem(plus.io.PRIVATE_DOC, (fs) => {
			fs.root.getDirectory('exports', { create: true }, (dir) => {
				dir.getFile(fileName, { create: true, exclusive: false }, (fileEntry) => {
					fileEntry.createWriter((writer) => {
						writer.onerror = (e) => reject(e)
						writer.onwrite = () => {
							const localUrl = fileEntry.toLocalURL()
							const abs = plus.io.convertLocalFileSystemURL(localUrl)
							resolve({ localUrl, absPath: abs, fileEntry })
						}
						writer.seek(0)
						writer.write(content)
					}, reject)
				}, reject)
			}, reject)
		}, reject)
	})
}

function downloadJsonH5(fileName, content) {
	const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = fileName
	a.style.display = 'none'
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
	setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function shareViaUni(path) {
	return new Promise((resolve, reject) => {
		if (typeof uni.shareWithSystem !== 'function') {
			reject(new Error('no uni.shareWithSystem'))
			return
		}
		uni.shareWithSystem({
			type: 'file',
			summary: '戒断打卡记录',
			path,
			success: () => resolve(true),
			fail: (err) => reject(err)
		})
	})
}

function shareViaIntent(absPath, fileName) {
	if (!isApp()) return false
	const main = getMainActivity()
	const Intent = plus.android.importClass('android.content.Intent')
	const File = plus.android.importClass('java.io.File')
	const Uri = plus.android.importClass('android.net.Uri')
	const Build = plus.android.importClass('android.os.Build')
	const file = new File(absPath)
	if (!file.exists()) throw new Error('文件不存在')

	let uri = null
	if (Build.VERSION.SDK_INT >= 24) {
		const FileProvider = plus.android.importClass('androidx.core.content.FileProvider')
		const pkg = main.getPackageName()
		const authorities = [
			`${pkg}.dc.fileprovider`,
			`${pkg}.fileprovider`,
			'io.dcloud.application.DCloud_FileProvider'
		]
		for (const auth of authorities) {
			try {
				uri = FileProvider.getUriForFile(main, auth, file)
				if (uri) break
			} catch (e) {}
		}
		if (!uri) throw new Error('FileProvider 不可用')
	} else {
		uri = Uri.fromFile(file)
	}

	const intent = new Intent(Intent.ACTION_SEND)
	intent.setType('application/json')
	intent.putExtra(Intent.EXTRA_STREAM, uri)
	intent.putExtra(Intent.EXTRA_SUBJECT, fileName)
	intent.putExtra(Intent.EXTRA_TEXT, '戒断 App 打卡记录')
	intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
	main.startActivity(Intent.createChooser(intent, '分享打卡记录'))
	return true
}

/**
 * @param {{ password?: string }} [options] 传入 password 则导出加密 JSON
 */
export async function exportAndShareCheckins(options = {}) {
	const built = buildCheckinExport()
	let { json, count, fileName } = built
	if (!count) {
		return { ok: false, count: 0, message: '暂无打卡记录可导出' }
	}

	let encrypted = false
	const password = String((options && options.password) || '')
	if (password) {
		try {
			const payload = await encryptPayloadJson(json, password)
			json = JSON.stringify(payload, null, 2)
			fileName = fileName.replace(/\.json$/i, '.encrypted.json')
			encrypted = true
		} catch (e) {
			return { ok: false, count, message: (e && e.message) || '加密失败' }
		}
	}

	if (isH5() || (!isApp() && typeof document !== 'undefined')) {
		try {
			downloadJsonH5(fileName, json)
			return {
				ok: true,
				count,
				encrypted,
				mode: 'download',
				message: encrypted ? `已下载加密文件 ${fileName}` : `已下载 ${fileName}`
			}
		} catch (e) {
			return { ok: false, count, message: '下载失败' }
		}
	}

	if (!isApp()) {
		return { ok: false, count, message: '当前环境不支持导出文件' }
	}

	try {
		const written = await writeDocFile(fileName, json)
		try {
			await shareViaUni(written.localUrl)
			return { ok: true, count, encrypted, mode: 'system-file', fileName }
		} catch (e1) {
			try {
				shareViaIntent(written.absPath, fileName)
				return { ok: true, count, encrypted, mode: 'intent-file', fileName }
			} catch (e2) {
				return { ok: false, count, message: '已生成文件，但分享失败' }
			}
		}
	} catch (e) {
		return { ok: false, count, message: '导出失败，请重试' }
	}
}

function readTextFromAndroidUri(uri) {
	const main = getMainActivity()
	const resolver = main.getContentResolver()
	const inputStream = resolver.openInputStream(uri)
	const InputStreamReader = plus.android.importClass('java.io.InputStreamReader')
	const BufferedReader = plus.android.importClass('java.io.BufferedReader')
	const reader = new BufferedReader(new InputStreamReader(inputStream, 'UTF-8'))
	let line
	const chunks = []
	while ((line = reader.readLine()) != null) {
		chunks.push(line)
	}
	reader.close()
	inputStream.close()
	return chunks.join('\n')
}

/**
 * 通过 Activity 结果总线选文件，避免永久劫持 onActivityResult
 */
function pickJsonFileApp() {
	return new Promise((resolve, reject) => {
		const main = getMainActivity()
		const Intent = plus.android.importClass('android.content.Intent')
		const intent = new Intent(Intent.ACTION_GET_CONTENT)
		intent.addCategory(Intent.CATEGORY_OPENABLE)
		intent.setType('application/json')

		if (!globalThis.__jieduanActivityResultHub) {
			const previous = main.onActivityResult
			globalThis.__jieduanActivityResultHub = {
				handlers: new Map(),
				previous: typeof previous === 'function' ? previous : null
			}
			main.onActivityResult = function (requestCode, resultCode, data) {
				const hub = globalThis.__jieduanActivityResultHub
				const handler = hub && hub.handlers.get(requestCode)
				if (handler) {
					hub.handlers.delete(requestCode)
					handler(resultCode, data)
					return
				}
				if (hub && typeof hub.previous === 'function') {
					hub.previous.call(this, requestCode, resultCode, data)
				}
			}
		}

		const hub = globalThis.__jieduanActivityResultHub
		const timeout = setTimeout(() => {
			hub.handlers.delete(PICK_REQ_CODE)
			reject(new Error('选择文件超时'))
		}, 120000)

		hub.handlers.set(PICK_REQ_CODE, (resultCode, data) => {
			clearTimeout(timeout)
			try {
				if (resultCode !== -1 || !data) {
					reject(new Error('cancelled'))
					return
				}
				const uri = data.getData()
				if (!uri) {
					reject(new Error('未选择文件'))
					return
				}
				resolve(readTextFromAndroidUri(uri))
			} catch (e) {
				reject(e)
			}
		})

		main.startActivityForResult(Intent.createChooser(intent, '选择打卡 JSON'), PICK_REQ_CODE)
	})
}

function pickJsonFileH5() {
	return new Promise((resolve, reject) => {
		const input = document.createElement('input')
		input.type = 'file'
		input.accept = 'application/json,.json'
		input.style.display = 'none'
		input.onchange = () => {
			const file = input.files && input.files[0]
			document.body.removeChild(input)
			if (!file) {
				reject(new Error('cancelled'))
				return
			}
			const reader = new FileReader()
			reader.onload = () => resolve(String(reader.result || ''))
			reader.onerror = () => reject(new Error('读取失败'))
			reader.readAsText(file, 'utf-8')
		}
		document.body.appendChild(input)
		input.click()
	})
}

/**
 * @param {{ password?: string }} [options]
 */
export async function pickAndParseCheckinJson(options = {}) {
	let text = ''
	if (isApp()) {
		text = await pickJsonFileApp()
	} else if (isH5() || typeof document !== 'undefined') {
		text = await pickJsonFileH5()
	} else {
		throw new Error('当前环境不支持选择文件')
	}

	if (isEncryptedExport(text)) {
		const password = String((options && options.password) || '')
		if (!password) {
			return { encrypted: true, needPassword: true, raw: text }
		}
		try {
			text = await decryptPayloadToJson(text, password)
		} catch (e) {
			throw new Error((e && e.message) || '解密失败')
		}
	}

	const cleaned = normalizeImportedCheckins(text)
	const count = Object.keys(cleaned).length
	if (!count) throw new Error('文件里没有有效打卡记录')
	return { checkins: cleaned, count, encrypted: !!((options && options.password)) }
}

/** 对已读入的加密原文继续解密解析 */
export async function parseEncryptedCheckinJson(raw, password) {
	const text = await decryptPayloadToJson(raw, password)
	const cleaned = normalizeImportedCheckins(text)
	const count = Object.keys(cleaned).length
	if (!count) throw new Error('文件里没有有效打卡记录')
	return { checkins: cleaned, count, encrypted: true }
}

function summarizeCheckins(map) {
	let success = 0
	let fail = 0
	let cigs = 0
	Object.keys(map || {}).forEach((key) => {
		const item = map[key]
		if (!item) return
		if (item.status === 'success') success += 1
		else if (item.status === 'fail' || item.status === 'relapse') {
			fail += 1
			cigs += Number(item.cigs) || 0
		}
	})
	return { success, fail, cigs, total: success + fail }
}

export function mergeImportedCheckins(importedMap) {
	const current = getCheckins() || {}
	const next = { ...current, ...importedMap }
	saveCheckins(next)
	const imported = summarizeCheckins(importedMap)
	const local = summarizeCheckins(next)
	return {
		mode: 'merge',
		imported: Object.keys(importedMap || {}).length,
		importedSuccess: imported.success,
		importedFail: imported.fail,
		total: local.total,
		success: local.success,
		fail: local.fail,
		cigs: local.cigs
	}
}

export function replaceImportedCheckins(importedMap) {
	const next = { ...(importedMap || {}) }
	saveCheckins(next)
	const local = summarizeCheckins(next)
	return {
		mode: 'replace',
		imported: local.total,
		importedSuccess: local.success,
		importedFail: local.fail,
		total: local.total,
		success: local.success,
		fail: local.fail,
		cigs: local.cigs
	}
}
