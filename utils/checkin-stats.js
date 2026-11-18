/**
 * 打卡统计（带版本缓存，避免首页多个 computed 反复全表扫描）
 */
import { getCheckins, getCheckinsVersion } from './storage.js'
import { todayStr, addDays, formatDate, pad } from './date.js'

let cache = {
	version: -1,
	today: '',
	year: 0,
	month: -1,
	streak: 0,
	monthSuccess: 0,
	monthFail: 0,
	monthCigs: 0
}

function ensureCache(year, month) {
	const version = getCheckinsVersion()
	const today = todayStr()
	if (
		cache.version === version &&
		cache.today === today &&
		cache.year === year &&
		cache.month === month
	) {
		return cache
	}

	const checkins = getCheckins()
	let monthSuccess = 0
	let monthFail = 0
	let monthCigs = 0
	const prefix = `${year}-${pad(month + 1)}-`

	Object.keys(checkins).forEach((key) => {
		if (!key.startsWith(prefix)) return
		const item = checkins[key]
		if (!item) return
		if (item.status === 'success') monthSuccess += 1
		else if (item.status === 'fail' || item.status === 'relapse') {
			monthFail += 1
			monthCigs += Number(item.cigs) || 0
		}
	})

	let streak = 0
	let cursor = new Date()
	// 今天尚未打卡成功时，从昨天起算连续
	const todayItem = checkins[today]
	if (!todayItem || todayItem.status !== 'success') {
		cursor = addDays(cursor, -1)
	}
	for (let i = 0; i < 3700; i++) {
		const key = formatDate(cursor)
		const item = checkins[key]
		if (!item || item.status !== 'success') break
		streak += 1
		cursor = addDays(cursor, -1)
	}

	cache = {
		version,
		today,
		year,
		month,
		streak,
		monthSuccess,
		monthFail,
		monthCigs
	}
	return cache
}

export function getMonthStats(year, month) {
	const c = ensureCache(year, month)
	return {
		success: c.monthSuccess,
		fail: c.monthFail,
		cigs: c.monthCigs
	}
}

export function getStreak(year, month) {
	return ensureCache(year, month).streak
}

export function statusOf(checkins, key) {
	const item = checkins[key]
	if (!item) return 'empty'
	if (item.status === 'success') return 'success'
	if (item.status === 'fail' || item.status === 'relapse') return 'fail'
	return 'empty'
}

export function cigsOf(checkins, key) {
	const item = checkins[key]
	if (!item) return 0
	if (item.status !== 'fail' && item.status !== 'relapse') return 0
	return Number(item.cigs) || 0
}
