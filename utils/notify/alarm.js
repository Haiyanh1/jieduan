import { isApp, getMainActivity } from '../platform.js'
import { getProfile, getMeta, saveMeta, saveProfile } from '../storage.js'
import { nextTriggerFromTime, formatDateTime } from '../date.js'
import { normalizeReminderTimes } from '../times.js'
import {
	areNotificationsEnabled,
	canScheduleExactAlarms,
	openExactAlarmSettings,
	isIgnoringBatteryOptimizations,
	requestIgnoreBatteryOptimizations
} from '../permissions.js'
import { ensureNotificationChannel } from './channel.js'
import { showLocalNotification } from './notification.js'
import {
	ALARM_REQ_BASE,
	TEST_ALARM_SLOT,
	ALARM_ACTION,
	ACTION_PREFIX
} from './constants.js'

function piFlags() {
	const PendingIntent = plus.android.importClass('android.app.PendingIntent')
	const Build = plus.android.importClass('android.os.Build')
	let flags = PendingIntent.FLAG_UPDATE_CURRENT
	if (Build.VERSION.SDK_INT >= 23) flags = flags | PendingIntent.FLAG_IMMUTABLE
	return flags
}

function buildBroadcastIntent(requestCode, timeLabel) {
	const main = getMainActivity()
	const Intent = plus.android.importClass('android.content.Intent')
	const intent = new Intent(ALARM_ACTION)
	intent.setPackage(main.getPackageName())
	intent.putExtra('jieduan_alarm', true)
	intent.putExtra('jieduan_time', timeLabel || '')
	intent.putExtra('jieduan_req', requestCode)
	return intent
}

function buildActivityIntent(requestCode, timeLabel) {
	const main = getMainActivity()
	const Intent = plus.android.importClass('android.content.Intent')
	const intent = new Intent(main, main.getClass())
	intent.setAction(ACTION_PREFIX + requestCode)
	intent.putExtra('jieduan_alarm', true)
	intent.putExtra('jieduan_time', timeLabel || '')
	intent.putExtra('jieduan_req', requestCode)
	intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP)
	return intent
}

function getBroadcastPendingIntent(requestCode, timeLabel) {
	const main = getMainActivity()
	const PendingIntent = plus.android.importClass('android.app.PendingIntent')
	return PendingIntent.getBroadcast(main, requestCode, buildBroadcastIntent(requestCode, timeLabel), piFlags())
}

function getActivityPendingIntent(requestCode, timeLabel) {
	const main = getMainActivity()
	const PendingIntent = plus.android.importClass('android.app.PendingIntent')
	return PendingIntent.getActivity(main, requestCode + 100, buildActivityIntent(requestCode, timeLabel), piFlags())
}

function getAlarmManager() {
	const main = getMainActivity()
	const Context = plus.android.importClass('android.content.Context')
	const am = main.getSystemService(Context.ALARM_SERVICE)
	plus.android.importClass(am)
	return am
}

function cancelSlot(am, requestCode) {
	try {
		const bPi = getBroadcastPendingIntent(requestCode, '')
		const aPi = getActivityPendingIntent(requestCode, '')
		am.cancel(bPi)
		am.cancel(aPi)
		try { bPi.cancel() } catch (e) {}
		try { aPi.cancel() } catch (e) {}
	} catch (e) {}
}

function cancelDailyReminders() {
	if (!isApp()) return
	try {
		const am = getAlarmManager()
		for (let i = 0; i < TEST_ALARM_SLOT; i++) {
			cancelSlot(am, ALARM_REQ_BASE + i)
		}
	} catch (e) {
		console.warn('cancelDailyReminders', e)
	}
}

export function cancelAllReminders() {
	if (!isApp()) return
	try {
		const am = getAlarmManager()
		for (let i = 0; i < 8; i++) {
			cancelSlot(am, ALARM_REQ_BASE + i)
		}
	} catch (e) {
		console.warn('cancelAllReminders', e)
	}
	if (globalThis.__jieduanTestTimer) {
		clearTimeout(globalThis.__jieduanTestTimer)
		globalThis.__jieduanTestTimer = null
	}
}

function safeTriggerTime(date, minAheadMs = 60 * 1000) {
	const min = Date.now() + minAheadMs
	const t = date instanceof Date ? date.getTime() : Number(date) || 0
	return Math.max(t, min)
}

function scheduleTrigger(am, triggerAt, requestCode, timeLabel, minAheadMs) {
	const AlarmManager = plus.android.importClass('android.app.AlarmManager')
	const Build = plus.android.importClass('android.os.Build')
	const trigger = safeTriggerTime(triggerAt, minAheadMs)
	const bPi = getBroadcastPendingIntent(requestCode, timeLabel)
	const aPi = getActivityPendingIntent(requestCode, timeLabel)
	const modes = []

	try {
		const canExact = Build.VERSION.SDK_INT < 31 || canScheduleExactAlarms()
		if (canExact && Build.VERSION.SDK_INT >= 23) {
			am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, bPi)
			modes.push('exact-broadcast')
		}
	} catch (e) {
		console.warn('setExactAndAllowWhileIdle broadcast', e)
	}

	// AlarmClock + Activity：进程被杀后系统仍可能拉起
	try {
		if (Build.VERSION.SDK_INT >= 21) {
			const AlarmClockInfo = plus.android.importClass('android.app.AlarmManager$AlarmClockInfo')
			const info = new AlarmClockInfo(trigger, aPi)
			am.setAlarmClock(info, aPi)
			modes.push('alarm-clock-activity')
		}
	} catch (e) {
		console.warn('setAlarmClock activity', e)
	}

	if (!modes.length) {
		try {
			am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, bPi)
			modes.push('inexact-broadcast')
		} catch (e) {
			try {
				am.set(AlarmManager.RTC_WAKEUP, trigger, bPi)
				modes.push('basic-broadcast')
			} catch (e2) {
				console.warn('scheduleTrigger fail', e2)
				return 'fail'
			}
		}
	}
	return modes.join('+')
}

let scheduleRemindersImpl = null
let registerAlarmReceiverImpl = null

export function bindAlarmDeps({ scheduleReminders, registerAlarmReceiver }) {
	scheduleRemindersImpl = scheduleReminders
	registerAlarmReceiverImpl = registerAlarmReceiver
}

export function fireReminderFromAlarm(timeLabel, source) {
	const meta = getMeta()
	if (meta.lastAlarmAt && Date.now() - meta.lastAlarmAt < 8000) {
		return false
	}
	saveMeta({ lastAlarmAt: Date.now(), lastAlarmSource: source || '' })
	showLocalNotification({
		title: '戒断 · 打卡提醒',
		content: timeLabel
			? `现在是 ${timeLabel}，记一下今天有没有抽烟。`
			: '到点了，记一下今天有没有抽烟。',
		payload: 'notify'
	})
	const isTest = String(timeLabel || '').indexOf('分钟测试') >= 0
	if (!isTest && typeof scheduleRemindersImpl === 'function') {
		scheduleRemindersImpl(true)
	}
	return true
}

/**
 * @param {boolean} force
 * @param {{ ensureExact?: boolean }} options
 */
export function scheduleReminders(force = false, options = {}) {
	if (typeof registerAlarmReceiverImpl === 'function') {
		registerAlarmReceiverImpl()
	}
	const profile = getProfile()
	const times = normalizeReminderTimes(profile.reminderTimes)

	if (JSON.stringify(times) !== JSON.stringify(profile.reminderTimes || [])) {
		saveProfile({ reminderTimes: times })
	}

	if (!profile.reminderEnabled) {
		cancelAllReminders()
		return { scheduled: [], disabled: true }
	}
	if (!isApp()) {
		return { scheduled: [], h5: true }
	}
	ensureNotificationChannel()
	if (!areNotificationsEnabled()) {
		return { scheduled: [], needNotifyPermission: true }
	}
	if (!times.length) {
		cancelDailyReminders()
		return { scheduled: [], empty: true }
	}

	if (options.ensureExact && !canScheduleExactAlarms()) {
		try {
			openExactAlarmSettings()
		} catch (e) {}
	}

	cancelDailyReminders()
	const am = getAlarmManager()
	const scheduled = []
	const now = Date.now()
	times.forEach((t, idx) => {
		const when = nextTriggerFromTime(t)
		const at = safeTriggerTime(when, 60 * 1000)
		if (at <= now + 5000) return
		const req = ALARM_REQ_BASE + idx
		const mode = scheduleTrigger(am, new Date(at), req, t, 60 * 1000)
		scheduled.push({ time: t, at, label: formatDateTime(new Date(at)), req, mode })
	})

	try {
		const SystemClock = plus.android.importClass('android.os.SystemClock')
		saveMeta({
			lastScheduleAt: Date.now(),
			scheduleSnapshot: scheduled,
			force: !!force,
			lastElapsedRealtime: Number(SystemClock.elapsedRealtime()) || 0,
			needsReschedule: false
		})
	} catch (e) {
		saveMeta({ lastScheduleAt: Date.now(), scheduleSnapshot: scheduled, force: !!force, needsReschedule: false })
	}
	return { scheduled }
}

export function scheduleTestReminderInMinutes(minutes = 1) {
	if (!isApp()) return { ok: false, message: '仅 App 可用' }
	if (typeof registerAlarmReceiverImpl === 'function') {
		registerAlarmReceiverImpl()
	}
	ensureNotificationChannel()
	try {
		if (!isIgnoringBatteryOptimizations()) {
			requestIgnoreBatteryOptimizations()
		}
	} catch (e) {}

	const mins = Math.max(1, Math.min(10, Number(minutes) || 1))
	const ms = mins * 60 * 1000
	const when = new Date(Date.now() + ms)
	const req = ALARM_REQ_BASE + TEST_ALARM_SLOT
	const label = `${mins}分钟测试`
	const am = getAlarmManager()
	cancelSlot(am, req)
	const mode = scheduleTrigger(am, when, req, label, 50 * 1000)

	if (globalThis.__jieduanTestTimer) {
		clearTimeout(globalThis.__jieduanTestTimer)
	}
	globalThis.__jieduanTestTimer = setTimeout(() => {
		globalThis.__jieduanTestTimer = null
		fireReminderFromAlarm(label, 'js-timer')
	}, ms)

	return {
		ok: mode !== 'fail',
		mode,
		at: formatDateTime(when),
		message: mode === 'fail' ? '安排失败' : `已安排 ${mins} 分钟后提醒`
	}
}

function readAlarmExtrasFromIntent(intent) {
	if (!intent) return null
	plus.android.importClass(intent)
	let fromAlarm = false
	let fromNotify = false
	let timeLabel = ''
	try {
		fromAlarm = !!intent.getBooleanExtra('jieduan_alarm', false)
	} catch (e) {}
	try {
		fromNotify = !!intent.getBooleanExtra('jieduan_from_notify', false)
	} catch (e) {}
	try {
		timeLabel = intent.getStringExtra('jieduan_time') || ''
	} catch (e) {}
	try {
		const action = String(intent.getAction() || '')
		if (!fromAlarm && action.indexOf(ACTION_PREFIX) === 0) fromAlarm = true
		if (!fromAlarm && action === ALARM_ACTION) fromAlarm = true
	} catch (e) {}
	if (!fromAlarm && !fromNotify) return null
	return { fromAlarm, fromNotify, timeLabel }
}

export function handleLaunchFromAlarm() {
	if (!isApp()) return false
	try {
		const main = getMainActivity()
		const intent = main.getIntent()

		// 开机插件拉起：只重挂，不弹通知
		try {
			plus.android.importClass(intent)
			if (intent.getBooleanExtra('jieduan_boot_reschedule', false)) {
				intent.removeExtra('jieduan_boot_reschedule')
				main.setIntent(intent)
				saveMeta({ needsReschedule: true })
				scheduleReminders(true)
				return false
			}
		} catch (e) {}

		const info = readAlarmExtrasFromIntent(intent)
		if (!info) return false

		try {
			intent.removeExtra('jieduan_alarm')
			intent.removeExtra('jieduan_from_notify')
			intent.removeExtra('jieduan_time')
			intent.removeExtra('jieduan_req')
			main.setIntent(intent)
		} catch (e) {}

		if (info.fromAlarm) {
			fireReminderFromAlarm(info.timeLabel, 'activity')
			return true
		}
		return !!info.fromNotify
	} catch (e) {
		console.warn('handleLaunchFromAlarm', e)
		return false
	}
}
