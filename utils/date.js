/** 日期工具：全部按本地时区处理 */

export function pad(n) {
	return String(n).padStart(2, '0')
}

export function formatDate(date = new Date()) {
	const d = date instanceof Date ? date : new Date(date)
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function formatDateTime(date = new Date()) {
	const d = date instanceof Date ? date : new Date(date)
	return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function startOfDay(date = new Date()) {
	const d = date instanceof Date ? date : new Date(date)
	return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

export function addDays(date, n) {
	const d = startOfDay(date)
	d.setDate(d.getDate() + n)
	return d
}

export function todayStr() {
	return formatDate(new Date())
}

export function parseTimeToToday(hhmm) {
	const [h, m] = String(hhmm || '09:00').split(':').map(Number)
	const d = new Date()
	d.setHours(h || 0, m || 0, 0, 0)
	return d
}

export function nextTriggerFromTime(hhmm) {
	const target = parseTimeToToday(hhmm)
	// 已过的时刻改约明天；60 秒内的也推明天，避免刚打开开关立刻响一次
	if (target.getTime() <= Date.now() + 60 * 1000) {
		target.setDate(target.getDate() + 1)
	}
	return target
}

export function monthMatrix(year, month) {
	// month: 0-11；固定 6 行，空位用上/下月日期填满（浅色），高度稳定且不显得空
	const first = new Date(year, month, 1)
	// 周一为一周起始：0 Mon ... 6 Sun
	const startWeekday = (first.getDay() + 6) % 7
	const daysInMonth = new Date(year, month + 1, 0).getDate()
	const prevMonthDays = new Date(year, month, 0).getDate()
	const cells = []

	for (let i = 0; i < startWeekday; i++) {
		const day = prevMonthDays - startWeekday + 1 + i
		cells.push({ day, inMonth: false, offset: -1 })
	}
	for (let d = 1; d <= daysInMonth; d++) {
		cells.push({ day: d, inMonth: true, offset: 0 })
	}
	let next = 1
	while (cells.length < 42) {
		cells.push({ day: next++, inMonth: false, offset: 1 })
	}
	return cells
}
