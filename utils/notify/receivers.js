/**
 * 运行时广播注册
 *
 * 说明：
 * - BOOT_COMPLETED 在 Android 上必须由 Manifest 静态 Receiver 接收；
 *   纯 JS 动态 registerReceiver 在进程未启动时无效。
 * - 本模块在进程存活时注册闹钟广播；开机后依赖「下次打开 App」或
 *   nativeplugins/JieduanBoot 静态 Receiver 拉起后重挂。
 * - AlarmClock Activity 路径可在进程被杀后由系统拉起，作为主兜底。
 */
import { isApp, getMainActivity } from '../platform.js'
import { getMeta, saveMeta } from '../storage.js'
import { ALARM_ACTION, BOOT_ACTIONS } from './constants.js'
import {
	fireReminderFromAlarm,
	handleLaunchFromAlarm,
	scheduleReminders
} from './alarm.js'

export function registerAlarmReceiver() {
	if (!isApp()) return false
	try {
		if (globalThis.__jieduanAlarmReceiverBound) return true
		const main = getMainActivity()
		const Build = plus.android.importClass('android.os.Build')
		const IntentFilter = plus.android.importClass('android.content.IntentFilter')
		const Context = plus.android.importClass('android.content.Context')
		const receiver = plus.android.implements('io.dcloud.android.content.BroadcastReceiver', {
			onReceive(context, intent) {
				try {
					plus.android.importClass(intent)
					let timeLabel = ''
					try {
						timeLabel = intent.getStringExtra('jieduan_time') || ''
					} catch (e) {}
					fireReminderFromAlarm(timeLabel, 'broadcast')
				} catch (e) {
					console.warn('alarm onReceive', e)
				}
			}
		})
		const filter = new IntentFilter(ALARM_ACTION)
		if (Build.VERSION.SDK_INT >= 33) {
			main.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
		} else {
			main.registerReceiver(receiver, filter)
		}
		globalThis.__jieduanAlarmReceiver = receiver
		globalThis.__jieduanAlarmReceiverBound = true
		return true
	} catch (e) {
		console.warn('registerAlarmReceiver', e)
		return false
	}
}

/**
 * 尽力注册开机广播（进程已在时有用；冷启动后须靠静态 Receiver / 下次打开）
 * 同时把 needsReschedule 标记写入 meta，便于下次 onShow 强制重挂。
 */
export function registerBootReceiver() {
	if (!isApp()) return false
	try {
		const main = getMainActivity()
		if (globalThis.__jieduanBootReceiverBound) return true
		const receiver = plus.android.implements('io.dcloud.android.content.BroadcastReceiver', {
			onReceive() {
				try {
					saveMeta({ needsReschedule: true, lastBootSignalAt: Date.now() })
					scheduleReminders(true)
				} catch (e) {
					console.warn('boot onReceive', e)
				}
			}
		})
		const IntentFilter = plus.android.importClass('android.content.IntentFilter')
		const filter = new IntentFilter()
		BOOT_ACTIONS.forEach((action) => filter.addAction(action))
		try {
			const Build = plus.android.importClass('android.os.Build')
			const Context = plus.android.importClass('android.content.Context')
			if (Build.VERSION.SDK_INT >= 33) {
				main.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
			} else {
				main.registerReceiver(receiver, filter)
			}
		} catch (e) {
			main.registerReceiver(receiver, filter)
		}
		globalThis.__jieduanBootReceiver = receiver
		globalThis.__jieduanBootReceiverBound = true
		return true
	} catch (e) {
		console.warn('registerBootReceiver', e)
		return false
	}
}

/** 检测重启或 needsReschedule 标记，强制重挂闹钟 */
export function rescheduleIfRebooted() {
	if (!isApp()) return false
	try {
		const SystemClock = plus.android.importClass('android.os.SystemClock')
		const elapsed = Number(SystemClock.elapsedRealtime()) || 0
		const meta = getMeta()
		const last = Number(meta.lastElapsedRealtime) || 0
		const rebooted = last > 0 && elapsed + 5000 < last
		const flagged = !!meta.needsReschedule
		saveMeta({ lastElapsedRealtime: elapsed })
		if (rebooted || flagged) {
			scheduleReminders(true)
			return true
		}
		return false
	} catch (e) {
		return false
	}
}

/**
 * 每次回到前台都尽力重挂（弥补开机静态 Receiver 未接入时的空窗）
 * 未开启提醒时为空操作。
 */
export function ensureRemindersAlive() {
	if (!isApp()) return { skipped: true }
	try {
		registerAlarmReceiver()
		const rebooted = rescheduleIfRebooted()
		if (!rebooted) {
			scheduleReminders(true)
		}
		return { ok: true, rebooted: !!rebooted }
	} catch (e) {
		console.warn('ensureRemindersAlive', e)
		return { ok: false }
	}
}

export function bindAlarmIntentListener() {
	if (!isApp()) return
	try {
		registerAlarmReceiver()
		if (globalThis.__jieduanNewIntentBound) return
		globalThis.__jieduanNewIntentBound = true
		plus.globalEvent.addEventListener('newintent', () => {
			setTimeout(() => {
				handleLaunchFromAlarm()
			}, 50)
		})
	} catch (e) {
		console.warn('bindAlarmIntentListener', e)
	}
}
