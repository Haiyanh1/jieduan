import { isApp, getMainActivity } from '../platform.js'
import { CHANNEL_ID, CHANNEL_NAME } from './constants.js'

export function ensureNotificationChannel() {
	if (!isApp()) return
	try {
		const main = getMainActivity()
		const Build = plus.android.importClass('android.os.Build')
		if (Build.VERSION.SDK_INT < 26) return
		const Context = plus.android.importClass('android.content.Context')
		const NotificationManager = plus.android.importClass('android.app.NotificationManager')
		const NotificationChannel = plus.android.importClass('android.app.NotificationChannel')
		const nm = main.getSystemService(Context.NOTIFICATION_SERVICE)
		plus.android.importClass(nm)
		let existing = null
		try {
			existing = nm.getNotificationChannel(CHANNEL_ID)
		} catch (e) {}
		if (existing) {
			try {
				if (existing.getImportance && existing.getImportance() < NotificationManager.IMPORTANCE_DEFAULT) {
					nm.deleteNotificationChannel(CHANNEL_ID)
				} else {
					return
				}
			} catch (e) {
				return
			}
		}
		const channel = new NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH)
		channel.setDescription('每日戒烟打卡通知栏提醒')
		channel.enableVibration(true)
		channel.setShowBadge(true)
		nm.createNotificationChannel(channel)
	} catch (e) {
		console.warn('ensureNotificationChannel', e)
	}
}
