/**
 * 自动本地备份：写入 App 私有目录 backups/
 */
import { getProfile, getMeta, saveMeta, flushCheckins } from './storage.js'
import { buildCheckinExport } from './export.js'
import { isApp } from './platform.js'

const BACKUP_DIR = 'backups'
const KEEP_MAX = 8

function clampDays(n) {
	const v = Math.round(Number(n) || 7)
	return Math.max(1, Math.min(90, v))
}

export function normalizeBackupDays(n) {
	return clampDays(n)
}

function writeBackupFile(fileName, content) {
	return new Promise((resolve, reject) => {
		if (!isApp()) {
			reject(new Error('仅 App 支持自动备份'))
			return
		}
		plus.io.requestFileSystem(plus.io.PRIVATE_DOC, (fs) => {
			fs.root.getDirectory(BACKUP_DIR, { create: true }, (dir) => {
				dir.getFile(fileName, { create: true, exclusive: false }, (fileEntry) => {
					fileEntry.createWriter((writer) => {
						writer.onerror = (e) => reject(e)
						writer.onwrite = () => {
							resolve({
								localUrl: fileEntry.toLocalURL(),
								absPath: plus.io.convertLocalFileSystemURL(fileEntry.toLocalURL()),
								fileName
							})
						}
						writer.seek(0)
						writer.write(content)
					}, reject)
				}, reject)
			}, reject)
		}, reject)
	})
}

function listBackupEntries() {
	return new Promise((resolve) => {
		if (!isApp()) {
			resolve([])
			return
		}
		plus.io.requestFileSystem(plus.io.PRIVATE_DOC, (fs) => {
			fs.root.getDirectory(BACKUP_DIR, { create: true }, (dir) => {
				const reader = dir.createReader()
				reader.readEntries((entries) => {
					const files = (entries || [])
						.filter((e) => e.isFile && /\.json$/i.test(e.name || ''))
						.sort((a, b) => String(b.name).localeCompare(String(a.name)))
					resolve(files)
				}, () => resolve([]))
			}, () => resolve([]))
		}, () => resolve([]))
	})
}

async function pruneOldBackups() {
	try {
		const files = await listBackupEntries()
		if (files.length <= KEEP_MAX) return
		const drop = files.slice(KEEP_MAX)
		drop.forEach((entry) => {
			try { entry.remove(() => {}, () => {}) } catch (e) {}
		})
	} catch (e) {}
}

/** 立即写一份备份（忽略周期） */
export async function createLocalBackup({ reason = 'manual' } = {}) {
	flushCheckins()
	const { json, count } = buildCheckinExport()
	if (!count) {
		return { ok: false, empty: true, message: '暂无打卡记录可备份' }
	}
	if (!isApp()) {
		// H5：落到 localStorage 作轻量备份标记
		try {
			uni.setStorageSync('jq_backup_last_json', json)
			saveMeta({ lastBackupAt: Date.now(), lastBackupCount: count, lastBackupReason: reason })
			return { ok: true, count, mode: 'storage', message: `已备份 ${count} 条到本地缓存` }
		} catch (e) {
			return { ok: false, message: '备份失败' }
		}
	}
	const stamp = new Date().toISOString().replace(/[:.]/g, '-')
	const fileName = `jieduan-backup-${stamp}.json`
	try {
		const written = await writeBackupFile(fileName, json)
		await pruneOldBackups()
		saveMeta({
			lastBackupAt: Date.now(),
			lastBackupCount: count,
			lastBackupFile: fileName,
			lastBackupReason: reason
		})
		return {
			ok: true,
			count,
			fileName,
			path: written.absPath,
			mode: 'file',
			message: `已备份 ${count} 条`
		}
	} catch (e) {
		console.warn('createLocalBackup', e)
		return { ok: false, message: '备份失败' }
	}
}

/**
 * 按设置周期自动备份
 * @returns {{ ran: boolean, result?: object, nextInDays?: number }}
 */
export async function maybeAutoBackup() {
	const profile = getProfile()
	if (profile.backupEnabled === false) {
		return { ran: false, disabled: true }
	}
	const days = clampDays(profile.backupIntervalDays)
	const meta = getMeta()
	const last = Number(meta.lastBackupAt) || 0
	const due = !last || (Date.now() - last) >= days * 24 * 60 * 60 * 1000
	if (!due) {
		const remainMs = days * 24 * 60 * 60 * 1000 - (Date.now() - last)
		return { ran: false, nextInDays: Math.max(0, Math.ceil(remainMs / (24 * 60 * 60 * 1000))) }
	}
	const result = await createLocalBackup({ reason: 'auto' })
	return { ran: !!result.ok, result }
}

export function formatBackupStatus() {
	const profile = getProfile()
	const meta = getMeta()
	const days = clampDays(profile.backupIntervalDays)
	const enabled = profile.backupEnabled !== false
	const last = Number(meta.lastBackupAt) || 0
	let lastText = '尚未备份'
	if (last) {
		const d = new Date(last)
		const pad = (n) => String(n).padStart(2, '0')
		lastText = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
		if (meta.lastBackupCount) lastText += ` · ${meta.lastBackupCount} 条`
	}
	return {
		enabled,
		days,
		lastText,
		lastAt: last,
		fileName: meta.lastBackupFile || ''
	}
}
