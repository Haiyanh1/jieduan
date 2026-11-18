/**
 * 本地提醒公共入口（仅导出业务侧需要的 API）
 */
import { bindAlarmDeps, scheduleReminders as scheduleRemindersCore } from './alarm.js'
import { registerAlarmReceiver } from './receivers.js'

bindAlarmDeps({
	scheduleReminders: scheduleRemindersCore,
	registerAlarmReceiver
})

export { ensureNotificationChannel } from './channel.js'
export { sendTestNotification } from './notification.js'
export {
	cancelAllReminders,
	scheduleReminders,
	scheduleTestReminderInMinutes,
	handleLaunchFromAlarm
} from './alarm.js'
export {
	registerAlarmReceiver,
	registerBootReceiver,
	rescheduleIfRebooted,
	ensureRemindersAlive,
	bindAlarmIntentListener
} from './receivers.js'
