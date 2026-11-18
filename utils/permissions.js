/**
 * Android / 小米澎湃 OS 权限与系统页跳转
 * 纯本地 App：通知、精确闹钟、忽略电池优化、自启动引导
 */

function isApp() {
	// #ifdef APP-PLUS
	return true
	// #endif
	return false
}

export function getAndroidVersion() {
	if (!isApp()) return 0
	try {
		const Build = plus.android.importClass('android.os.Build')
		return Number(Build.VERSION.SDK_INT) || 0
	} catch (e) {
		return 0
	}
}

export function isXiaomiFamily() {
	if (!isApp()) return false
	try {
		const Build = plus.android.importClass('android.os.Build')
		const brand = String(Build.BRAND || '').toLowerCase()
		const manufacturer = String(Build.MANUFACTURER || '').toLowerCase()
		const keys = ['xiaomi', 'redmi', 'poco', 'blackshark']
		return keys.some(k => brand.includes(k) || manufacturer.includes(k))
	} catch (e) {
		return false
	}
}

export function requestNotificationPermission() {
	return new Promise((resolve) => {
		if (!isApp()) {
			resolve({ granted: true, skipped: true })
			return
		}
		const sdk = getAndroidVersion()
		if (sdk < 33) {
			resolve({ granted: true, skipped: true })
			return
		}
		plus.android.requestPermissions(
			['android.permission.POST_NOTIFICATIONS'],
			(e) => {
				const granted = (e.granted || []).includes('android.permission.POST_NOTIFICATIONS')
				resolve({ granted, result: e })
			},
			(err) => resolve({ granted: false, error: err })
		)
	})
}

export function areNotificationsEnabled() {
	if (!isApp()) return true
	try {
		const main = plus.android.runtimeMainActivity()
		plus.android.importClass(main)
		const NotificationManagerCompat = plus.android.importClass('androidx.core.app.NotificationManagerCompat')
		try {
			return !!NotificationManagerCompat.from(main).areNotificationsEnabled()
		} catch (e1) {
			const nm = main.getSystemService(main.NOTIFICATION_SERVICE)
			plus.android.importClass(nm)
			if (typeof nm.areNotificationsEnabled === 'function') {
				return !!nm.areNotificationsEnabled()
			}
			return true
		}
	} catch (e) {
		return true
	}
}

export function canScheduleExactAlarms() {
	if (!isApp()) return true
	try {
		const sdk = getAndroidVersion()
		if (sdk < 31) return true
		const main = plus.android.runtimeMainActivity()
		const Context = plus.android.importClass('android.content.Context')
		const am = main.getSystemService(Context.ALARM_SERVICE)
		plus.android.importClass(am)
		if (typeof am.canScheduleExactAlarms === 'function') {
			return !!am.canScheduleExactAlarms()
		}
		return true
	} catch (e) {
		return true
	}
}

export function openExactAlarmSettings() {
	if (!isApp()) return false
	try {
		const Intent = plus.android.importClass('android.content.Intent')
		const Settings = plus.android.importClass('android.provider.Settings')
		const Uri = plus.android.importClass('android.net.Uri')
		const main = plus.android.runtimeMainActivity()
		const intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
		intent.setData(Uri.parse('package:' + main.getPackageName()))
		main.startActivity(intent)
		return true
	} catch (e) {
		return openAppNotificationSettings()
	}
}

export function openAppNotificationSettings() {
	if (!isApp()) return false
	try {
		const Intent = plus.android.importClass('android.content.Intent')
		const Settings = plus.android.importClass('android.provider.Settings')
		const Uri = plus.android.importClass('android.net.Uri')
		const main = plus.android.runtimeMainActivity()
		const intent = new Intent()
		intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
		intent.putExtra(Settings.EXTRA_APP_PACKAGE, main.getPackageName())
		intent.putExtra('app_package', main.getPackageName())
		intent.putExtra('app_uid', main.getApplicationInfo().uid)
		main.startActivity(intent)
		return true
	} catch (e) {
		return openAppDetailsSettings()
	}
}

export function openAppDetailsSettings() {
	if (!isApp()) return false
	try {
		const Intent = plus.android.importClass('android.content.Intent')
		const Settings = plus.android.importClass('android.provider.Settings')
		const Uri = plus.android.importClass('android.net.Uri')
		const main = plus.android.runtimeMainActivity()
		const intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
		intent.setData(Uri.parse('package:' + main.getPackageName()))
		main.startActivity(intent)
		return true
	} catch (e) {
		return false
	}
}

export function isIgnoringBatteryOptimizations() {
	if (!isApp()) return true
	try {
		const sdk = getAndroidVersion()
		if (sdk < 23) return true
		const main = plus.android.runtimeMainActivity()
		const Context = plus.android.importClass('android.content.Context')
		const pm = main.getSystemService(Context.POWER_SERVICE)
		plus.android.importClass(pm)
		return !!pm.isIgnoringBatteryOptimizations(main.getPackageName())
	} catch (e) {
		return false
	}
}

export function requestIgnoreBatteryOptimizations() {
	if (!isApp()) return false
	try {
		if (isIgnoringBatteryOptimizations()) return true
		const Intent = plus.android.importClass('android.content.Intent')
		const Settings = plus.android.importClass('android.provider.Settings')
		const Uri = plus.android.importClass('android.net.Uri')
		const main = plus.android.runtimeMainActivity()
		const intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
		intent.setData(Uri.parse('package:' + main.getPackageName()))
		main.startActivity(intent)
		return true
	} catch (e) {
		return openAppDetailsSettings()
	}
}

export async function ensureReminderPermissions() {
	const enabled = areNotificationsEnabled()
	const exact = canScheduleExactAlarms()
	let batteryOk = true
	try {
		batteryOk = isIgnoringBatteryOptimizations()
	} catch (e) {}
	return {
		notificationsEnabled: enabled,
		exactAlarm: exact,
		batteryOk,
		xiaomi: isXiaomiFamily(),
		ok: enabled
	}
}

/** 首次进入：请求通知权限；未开则引导系统通知设置 */
export async function askNotificationAccess() {
	const result = await requestNotificationPermission()
	const enabled = areNotificationsEnabled()
	if (!enabled) {
		openAppNotificationSettings()
	}
	return {
		granted: !!result.granted,
		enabled,
		ok: enabled
	}
}
