<script>
	import {
		scheduleReminders,
		handleLaunchFromAlarm,
		ensureNotificationChannel,
		registerBootReceiver,
		registerAlarmReceiver,
		ensureRemindersAlive,
		bindAlarmIntentListener
	} from './utils/notify.js'
	import { paintSystemBars } from './utils/systemui.js'
	import { flushCheckins } from './utils/storage.js'
	import { maybeAutoBackup } from './utils/backup.js'

	function syncSafeInsets() {
		try {
			const sys = uni.getSystemInfoSync() || {}
			const insets = sys.safeAreaInsets || {}
			const top = Number(insets.top || sys.statusBarHeight || 0)
			const bottom = Number(insets.bottom || 0)
			const root =
				(typeof document !== 'undefined' && (document.documentElement || document.body)) || null
			if (root && root.style) {
				root.style.setProperty('--app-status-bar', `${top}px`)
				root.style.setProperty('--app-safe-bottom', `${bottom}px`)
			}
		} catch (e) {}
	}

	function closeNativeSplash() {
		// #ifdef APP-PLUS
		try {
			plus.navigator.closeSplashscreen()
		} catch (e) {}
		// #endif
	}

	function bootNativeServices() {
		// #ifdef APP-PLUS
		try {
			ensureNotificationChannel()
			registerAlarmReceiver()
			bindAlarmIntentListener()
			registerBootReceiver()
			const fromAlarm = handleLaunchFromAlarm()
			if (!fromAlarm) ensureRemindersAlive()
			else scheduleReminders(true)
		} catch (e) {
			console.warn('bootNativeServices', e)
		}
		// #endif
	}

	export default {
		onLaunch() {
			syncSafeInsets()
			// #ifdef APP-PLUS
			closeNativeSplash()
			paintSystemBars()
			// 单次短延迟即可：关 splash + 刷系统栏 + 挂提醒
			setTimeout(() => {
				closeNativeSplash()
				paintSystemBars()
				bootNativeServices()
				maybeAutoBackup().catch(() => {})
			}, 40)
			// #endif
			// #ifndef APP-PLUS
			setTimeout(() => {
				maybeAutoBackup().catch(() => {})
			}, 80)
			// #endif
		},
		onShow() {
			syncSafeInsets()
			// #ifdef APP-PLUS
			closeNativeSplash()
			paintSystemBars()
			setTimeout(() => {
				try {
					handleLaunchFromAlarm()
					// 每次回前台重挂，缩短「重启后到再打开」的提醒空窗
					ensureRemindersAlive()
					maybeAutoBackup().catch(() => {})
				} catch (e) {}
			}, 0)
			// #endif
		},
		onHide() {
			flushCheckins()
		}
	}
</script>

<style lang="scss">
	@import './common/theme.scss';

	page {
		background: $paper;
		background-color: $paper;
		color: $ink;
		@include body-font;
		font-size: 16px;
		box-sizing: border-box;
		width: 100%;
		min-height: 100%;
		height: 100%;
	}

	/* #ifdef APP-PLUS */
	uni-page-body,
	uni-page-wrapper,
	uni-app {
		background-color: $paper !important;
		height: 100%;
		min-height: 100%;
	}
	/* #endif */

	view, text {
		box-sizing: border-box;
	}

	.page {
		min-height: 100vh;
		min-height: 100dvh;
		padding: 0 44rpx;
		padding-bottom: constant(safe-area-inset-bottom);
		padding-bottom: var(--app-safe-bottom, env(safe-area-inset-bottom, 0px));
		@include paper-surface;
		position: relative;
		overflow-x: hidden;
		overflow-y: auto;
		box-sizing: border-box;
		background-color: $paper;
		display: flex;
		flex-direction: column;
	}

	.page::before {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		opacity: 0.4;
		background-image:
			radial-gradient(circle at 12% 22%, rgba(70, 78, 88, 0.07) 0 1px, transparent 1.5px),
			radial-gradient(circle at 38% 58%, rgba(70, 78, 88, 0.05) 0 1px, transparent 1.5px),
			radial-gradient(circle at 72% 18%, rgba(70, 78, 88, 0.06) 0 1px, transparent 1.5px),
			radial-gradient(circle at 88% 70%, rgba(70, 78, 88, 0.05) 0 1px, transparent 1.5px),
			radial-gradient(circle at 55% 40%, rgba(70, 78, 88, 0.04) 0 1px, transparent 1.5px);
		background-size: 120px 160px, 160px 120px, 140px 180px, 180px 140px, 100px 100px;
	}

	.nav-space {
		height: var(--status-bar-height, var(--app-status-bar, 24px));
	}
</style>
