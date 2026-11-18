/**
 * 提醒时间规范化（唯一实现，避免 storage / notify 漂移）
 * @param {unknown} list
 * @returns {string[]} HH:mm 升序去重
 */
export function normalizeReminderTimes(list) {
	const out = []
	const seen = new Set()
	;(list || []).forEach((raw) => {
		const v = String(raw || '').trim()
		if (!/^\d{1,2}:\d{2}$/.test(v)) return
		const [h, m] = v.split(':')
		const hour = Number(h)
		const minute = Number(m)
		if (hour > 23 || minute > 59) return
		const t = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
		if (seen.has(t)) return
		seen.add(t)
		out.push(t)
	})
	out.sort()
	return out
}
