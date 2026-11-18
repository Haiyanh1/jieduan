/**
 * 本地存储：profile / checkins / meta
 * - 写操作带 try/catch，失败返回 false / 抛错由调用方处理
 * - checkins 内存缓存 + 防抖落盘，避免每次打卡整表同步卡顿
 */
import { normalizeReminderTimes } from './times.js'

const KEYS = {
	PROFILE: 'jq_profile',
	CHECKINS: 'jq_checkins',
	META: 'jq_meta'
}

/** 默认关闭提醒：需用户主动开启并授权，避免「显示已开但收不到」 */
const DEFAULT_PROFILE = {
	reminderEnabled: false,
	reminderTimes: ['09:00', '20:00'],
	backupEnabled: true,
	backupIntervalDays: 7
}

let checkinsCache = null
let checkinsVersion = 0
let pendingFlush = false

function read(key, fallback) {
	try {
		const v = uni.getStorageSync(key)
		if (v === '' || v === undefined || v === null) return fallback
		return v
	} catch (e) {
		return fallback
	}
}

function write(key, value) {
	try {
		uni.setStorageSync(key, value)
		return true
	} catch (e) {
		console.warn('[storage] write failed', key, e)
		return false
	}
}

function normalizeCheckinMap(raw) {
	const map = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
	const out = {}
	Object.keys(map).forEach((key) => {
		const item = map[key]
		if (!item || typeof item !== 'object') return
		let status = item.status
		if (status === 'relapse') status = 'fail'
		if (status !== 'success' && status !== 'fail') return
		out[key] = {
			date: key,
			status,
			cigs: status === 'fail' ? Math.max(1, Number(item.cigs) || 1) : 0,
			updatedAt: Number(item.updatedAt) || Date.now()
		}
	})
	return out
}

function bumpCheckins(nextMap) {
	checkinsCache = nextMap
	checkinsVersion += 1
	pendingFlush = true
}

/** 立即落盘（切页 / 导出前调用） */
export function flushCheckins() {
	if (!pendingFlush || !checkinsCache) return true
	const ok = write(KEYS.CHECKINS, checkinsCache)
	if (ok) pendingFlush = false
	return ok
}

export function getCheckinsVersion() {
	return checkinsVersion
}

function clampBackupDays(n) {
	const v = Math.round(Number(n) || 7)
	return Math.max(1, Math.min(90, v))
}

export function getProfile() {
	const raw = read(KEYS.PROFILE, {})
	const hasTimesKey = Array.isArray(raw.reminderTimes)
	const hasEnabledKey = Object.prototype.hasOwnProperty.call(raw, 'reminderEnabled')
	const hasBackupEnabled = Object.prototype.hasOwnProperty.call(raw, 'backupEnabled')
	return {
		...DEFAULT_PROFILE,
		// 老用户若从未写过该字段，保持「视为已开」会误导；仅当明确存过才尊重历史
		reminderEnabled: hasEnabledKey ? raw.reminderEnabled !== false : DEFAULT_PROFILE.reminderEnabled,
		reminderTimes: hasTimesKey
			? normalizeReminderTimes(raw.reminderTimes)
			: [...DEFAULT_PROFILE.reminderTimes],
		backupEnabled: hasBackupEnabled ? raw.backupEnabled !== false : DEFAULT_PROFILE.backupEnabled,
		backupIntervalDays: clampBackupDays(
			raw.backupIntervalDays != null ? raw.backupIntervalDays : DEFAULT_PROFILE.backupIntervalDays
		)
	}
}

export function saveProfile(partial) {
	const merged = { ...getProfile(), ...partial }
	if (Array.isArray(merged.reminderTimes)) {
		merged.reminderTimes = normalizeReminderTimes(merged.reminderTimes)
	}
	if (merged.backupIntervalDays != null) {
		merged.backupIntervalDays = clampBackupDays(merged.backupIntervalDays)
	}
	const ok = write(KEYS.PROFILE, merged)
	if (!ok) {
		uni.showToast({ title: '设置保存失败', icon: 'none' })
	}
	return merged
}

export function getCheckins() {
	if (checkinsCache) return checkinsCache
	checkinsCache = normalizeCheckinMap(read(KEYS.CHECKINS, {}))
	return checkinsCache
}

export function saveCheckins(map) {
	const next = normalizeCheckinMap(map || {})
	bumpCheckins(next)
	const ok = flushCheckins()
	if (!ok) {
		uni.showToast({ title: '打卡保存失败', icon: 'none' })
	}
	return ok
}

export function upsertCheckin(dateStr, data) {
	const map = { ...getCheckins() }
	let status = data && data.status
	if (status === 'relapse') status = 'fail'
	const cigs = status === 'fail'
		? Math.max(1, Number(data && data.cigs) || 1)
		: 0
	map[dateStr] = {
		...(map[dateStr] || {}),
		...data,
		date: dateStr,
		status,
		cigs,
		updatedAt: Date.now()
	}
	bumpCheckins(map)
	const ok = flushCheckins()
	if (!ok) {
		uni.showToast({ title: '打卡保存失败', icon: 'none' })
	}
	return map[dateStr]
}

export function removeCheckin(dateStr) {
	const map = { ...getCheckins() }
	delete map[dateStr]
	bumpCheckins(map)
	const ok = flushCheckins()
	if (!ok) {
		uni.showToast({ title: '清除失败', icon: 'none' })
	}
}

export function getMeta() {
	return read(KEYS.META, { lastAlarmAt: 0, installAt: Date.now() })
}

export function saveMeta(partial) {
	const next = { ...getMeta(), ...partial }
	write(KEYS.META, next)
	return next
}

