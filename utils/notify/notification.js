import { isApp, getMainActivity } from '../platform.js'
import { saveMeta } from '../storage.js'
import { ensureNotificationChannel } from './channel.js'
import { CHANNEL_ID, NOTIFY_ID } from './constants.js'

export function showLocalNotification({
	title = '戒断提醒',
	content = '到点了，记一下今天有没有抽烟。',
	payload = 'reminder'
} = {}) {
	if (!isApp()) {
		uni.showToast({ title: content, icon: 'none' })
		return false
	}
	ensureNotificationChannel()
	let ok = false
	try {
		plus.push.createMessage(content, payload, {
			title,
			cover: false,
			sound: 'system',
			when: new Date()
		})
		ok = true
	} catch (e) {
		console.warn('plus.push.createMessage failed', e)
	}
	try {
		const main = getMainActivity()
		const Context = plus.android.importClass('android.content.Context')
		const Intent = plus.android.importClass('android.content.Intent')
		const PendingIntent = plus.android.importClass('android.app.PendingIntent')
		const Build = plus.android.importClass('android.os.Build')
		const nm = main.getSystemService(Context.NOTIFICATION_SERVICE)
		plus.android.importClass(nm)

		const launch = new Intent(main, main.getClass())
		launch.setAction('jieduan.OPEN_FROM_NOTIFY')
		launch.putExtra('jieduan_from_notify', true)
		launch.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP)

		let flags = PendingIntent.FLAG_UPDATE_CURRENT
		if (Build.VERSION.SDK_INT >= 23) flags = flags | PendingIntent.FLAG_IMMUTABLE
		const pi = PendingIntent.getActivity(main, NOTIFY_ID, launch, flags)

		let notification
		try {
			const Builder = plus.android.importClass('androidx.core.app.NotificationCompat$Builder')
			const builder = new Builder(main, CHANNEL_ID)
			builder.setContentTitle(title)
			builder.setContentText(content)
			builder.setSmallIcon(main.getApplicationInfo().icon)
			builder.setAutoCancel(true)
			builder.setContentIntent(pi)
			builder.setPriority(1)
			builder.setVisibility(1)
			notification = builder.build()
		} catch (e2) {
			const Builder = plus.android.importClass('android.app.Notification$Builder')
			let builder
			if (Build.VERSION.SDK_INT >= 26) {
				builder = new Builder(main, CHANNEL_ID)
			} else {
				builder = new Builder(main)
			}
			builder.setContentTitle(title)
			builder.setContentText(content)
			builder.setSmallIcon(main.getApplicationInfo().icon)
			builder.setAutoCancel(true)
			builder.setContentIntent(pi)
			notification = builder.build()
		}
		nm.notify(NOTIFY_ID + (Date.now() % 97), notification)
		ok = true
	} catch (e) {
		console.warn('NotificationManager.notify failed', e)
	}
	saveMeta({ lastNotifyAt: Date.now() })
	return ok
}

export function sendTestNotification() {
	ensureNotificationChannel()
	return showLocalNotification({
		title: '戒断 · 测试通知',
		content: '如果你能看到这条通知，说明通知权限正常。',
		payload: 'test'
	})
}
