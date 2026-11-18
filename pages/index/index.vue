<template>
	<view class="page home">
		<ink-splash v-if="showInkSplash" ref="inkSplash" @done="onInkSplashDone" />
		<guide-steps v-if="showGuide" @done="onGuideDone" />
		<settings-panel
			v-if="showSettings"
			ref="settingsPanel"
			@checkins-changed="refresh"
			@closed="finalizeCloseSettings"
		/>

		<view class="content">
			<view class="fiber fiber-a"></view>
			<view class="fiber fiber-b"></view>
			<view class="nav-space"></view>

			<view class="topbar">
				<view class="brand-wrap">
					<text class="brand">戒断</text>
					<text class="brand-en">ROLL BACK</text>
				</view>
				<!-- 加大热区，避免二次进入后点不到 -->
				<view class="gear" hover-class="gear-hover" @click.stop="goSettings">
					<view class="gear-ring"></view>
					<view class="gear-core"></view>
					<text class="gear-text">设置</text>
				</view>
			</view>

			<view class="quote">
				<text class="quote-line">{{ quoteLine }}</text>
				<text class="quote-meta">{{ metaLine }}</text>
			</view>

			<month-calendar
				:year="year"
				:month="month"
				:today="today"
				:checkins="checkins"
				@update:year="year = $event"
				@update:month="month = $event"
				@day-tap="onDayTap"
				@day-longpress="onDayLongpress"
			/>

			<view class="seal-wrap">
				<view class="seal" :class="sealClass" @click="onSealTap">
					<view class="seal-ring">
						<text class="seal-main">{{ sealMain }}</text>
						<text class="seal-sub">{{ sealSub }}</text>
					</view>
				</view>
				<text class="seal-tip">{{ sealTip }}</text>
				<text
					v-if="todayStatus === 'fail'"
					class="recover"
					@click="recoverToday"
				>改回「未抽」</text>
				<text
					v-if="notifySoftTip"
					class="notify-soft"
					@click="goSettings"
				>通知未开启，提醒可能收不到 · 去设置</text>
			</view>
		</view>

		<paper-dialog
			:visible="dialog.visible"
			:title="dialog.title"
			:content="dialog.content"
			:cancel-text="dialog.cancelText"
			:confirm-text="dialog.confirmText"
			:tone="dialog.tone"
			:actions="dialog.actions"
			@close="closeDialog"
			@cancel="closeDialog"
			@confirm="onDialogConfirm"
			@action="onDialogAction"
		/>
	</view>
</template>

<script>
import PaperDialog from '../../components/PaperDialog.vue'
import InkSplash from '../../components/InkSplash.vue'
import MonthCalendar from '../../components/MonthCalendar.vue'
import SettingsPanel from '../../components/SettingsPanel.vue'
import GuideSteps from '../../components/GuideSteps.vue'
import paperDialogMixin from '../../mixins/paperDialog.js'
import {
	getCheckins,
	upsertCheckin,
	removeCheckin,
	getMeta,
	saveMeta,
	getProfile,
	flushCheckins
} from '../../utils/storage.js'
import { todayStr } from '../../utils/date.js'
import { getMonthStats, getStreak, statusOf, cigsOf } from '../../utils/checkin-stats.js'
import { askNotificationAccess, areNotificationsEnabled } from '../../utils/permissions.js'
import { scheduleReminders } from '../../utils/notify.js'
import { paintSystemBars } from '../../utils/systemui.js'

/**
 * 打卡状态机（按天）
 * empty   → 打卡 → success
 * success → 抽一支 → fail（cigs=1，连续中断）
 * fail    → 再点「抽了」→ cigs++
 * fail    → 「改回未抽」→ success（清空 cigs）
 */
export default {
	components: { PaperDialog, InkSplash, MonthCalendar, SettingsPanel, GuideSteps },
	mixins: [paperDialogMixin],
	data() {
		const now = new Date()
		return {
			showSettings: false,
			showGuide: false,
			showInkSplash: false,
			inkDone: false,
			year: now.getFullYear(),
			month: now.getMonth(),
			checkins: {},
			today: todayStr(),
			dayTimer: null,
			notifySoftTip: false,
			_openingSettings: false
		}
	},
	computed: {
		todayStatus() {
			return statusOf(this.checkins, this.today)
		},
		todayCigs() {
			return cigsOf(this.checkins, this.today)
		},
		monthStats() {
			return getMonthStats(this.year, this.month)
		},
		streak() {
			return getStreak(this.year, this.month)
		},
		quoteLine() {
			if (this.todayStatus === 'success') return '今天还好。把这一天留下。'
			if (this.todayStatus === 'fail') return '抽了也记下来。诚实比完美重要。'
			return '不追求完美，只把今天记清楚。'
		},
		metaLine() {
			if (this.todayStatus === 'fail') {
				return `连续 ${this.streak} 天 · 今天 ${this.todayCigs} 支 · 本月 ${this.monthStats.cigs} 支`
			}
			return `连续 ${this.streak} 天 · 本月未抽 ${this.monthStats.success} · 吸烟日 ${this.monthStats.fail}`
		},
		sealMain() {
			if (this.todayStatus === 'success') return '未抽'
			if (this.todayStatus === 'fail') return '已吸'
			return '打卡'
		},
		sealSub() {
			if (this.todayStatus === 'fail') return `${this.todayCigs} 支`
			return '记为未抽'
		},
		sealTip() {
			if (this.todayStatus === 'success') return '若今天抽了，点这里记录'
			if (this.todayStatus === 'fail') return '每点一次，支数 +1'
			return '点一次即可完成今日打卡'
		},
		sealClass() {
			return {
				done: this.todayStatus === 'success',
				fail: this.todayStatus === 'fail'
			}
		}
	},
	onLoad() {
		this.boot()
		this.startDayWatch()
	},
	onUnload() {
		this.stopDayWatch()
		flushCheckins()
	},
	onHide() {
		flushCheckins()
	},
	onShow() {
		paintSystemBars()
		this.clearBlockingOverlays()
		this.syncToday()
		this.checkins = getCheckins()
		this.refreshNotifySoftTip()
	},
	onBackPress() {
		if (this.showGuide) {
			return true
		}
		if (this.showSettings) {
			this.closeSettings()
			return true
		}
		return false
	},
	methods: {
		closeSettings() {
			const panel = this.$refs.settingsPanel
			if (panel && typeof panel.beginClose === 'function') {
				panel.beginClose()
				return
			}
			this.finalizeCloseSettings()
		},
		finalizeCloseSettings() {
			this.showSettings = false
			this.refresh()
			this.refreshNotifySoftTip()
			paintSystemBars()
		},
		/** 清掉异常残留的开屏遮罩，避免挡住点击 */
		clearBlockingOverlays() {
			if (this.showInkSplash && this.inkDone) {
				this.showInkSplash = false
			}
		},
		closeNativeSplash() {
			// #ifdef APP-PLUS
			try {
				plus.navigator.closeSplashscreen()
			} catch (e) {}
			// #endif
		},
		onInkSplashDone() {
			this.inkDone = true
			this.showInkSplash = false
			this.closeNativeSplash()
			this.maybeAskNotifyPermission()
			this.maybeShowGuide()
			this.refreshNotifySoftTip()
		},
		boot() {
			this.checkins = getCheckins()
			this.syncToday()
			this.closeNativeSplash()
			// 同一进程只播一次开屏
			if (globalThis.__jieduanInkShown) {
				this.inkDone = true
				this.showInkSplash = false
				this.maybeAskNotifyPermission()
				this.maybeShowGuide()
				this.refreshNotifySoftTip()
				return
			}
			globalThis.__jieduanInkShown = true
			this.inkDone = false
			this.showInkSplash = true
			setTimeout(() => {
				if (this.showInkSplash) this.onInkSplashDone()
			}, 3200)
		},
		syncToday() {
			const next = todayStr()
			if (next !== this.today) {
				this.today = next
				const now = new Date()
				if (this.year !== now.getFullYear() || this.month !== now.getMonth()) {
					this.year = now.getFullYear()
					this.month = now.getMonth()
				}
			} else {
				this.today = next
			}
		},
		startDayWatch() {
			this.stopDayWatch()
			this.dayTimer = setInterval(() => this.syncToday(), 30000)
		},
		stopDayWatch() {
			if (this.dayTimer) {
				clearInterval(this.dayTimer)
				this.dayTimer = null
			}
		},
		refreshNotifySoftTip() {
			try {
				const profile = getProfile()
				this.notifySoftTip = !!(profile.reminderEnabled && !areNotificationsEnabled())
			} catch (e) {
				this.notifySoftTip = false
			}
		},
		maybeAskNotifyPermission() {
			const meta = getMeta()
			if (meta.notifyPermissionAsked) return
			const profile = getProfile()
			// 默认提醒关闭时，不主动弹系统权限；等用户在设置里打开提醒
			if (!profile.reminderEnabled) {
				saveMeta({ notifyPermissionAsked: true })
				return
			}
			if (areNotificationsEnabled()) {
				saveMeta({ notifyPermissionAsked: true })
				return
			}
			saveMeta({ notifyPermissionAsked: true })
			this.openConfirm({
				title: '开启通知权限',
				content: '到点会通过通知提醒你打卡。首次使用需要允许通知权限。',
				confirmText: '去开启',
				cancelText: '以后再说',
				tone: 'calm',
				onConfirm: async () => {
					await askNotificationAccess()
					scheduleReminders(true)
					this.refreshNotifySoftTip()
				}
			})
		},
		maybeShowGuide() {
			const meta = getMeta()
			if (meta.homeGuideShown) return
			const delay = 500
			setTimeout(() => {
				if (this.showInkSplash) {
					setTimeout(() => this.maybeShowGuide(), 400)
					return
				}
				if (this.dialog.visible || this.showSettings || this.showGuide) {
					setTimeout(() => this.maybeShowGuide(), 800)
					return
				}
				if (getMeta().homeGuideShown) return
				this.showGuide = true
			}, delay)
		},
		onGuideDone() {
			this.showGuide = false
			saveMeta({ homeGuideShown: true })
		},
		goSettings() {
			// 同页全屏面板打开设置，避开部分机型第二 webview 白屏
			try {
				const splash = this.$refs.inkSplash
				if (splash && typeof splash.forceFinish === 'function') {
					splash.forceFinish({ silent: true })
				}
			} catch (e) {}
			this.showInkSplash = false
			this.inkDone = true
			globalThis.__jieduanInkShown = true
			this.forceCloseDialog()
			this.closeNativeSplash()
			flushCheckins()
			this.showSettings = true
		},
		refresh() {
			this.checkins = getCheckins()
		},
		markSuccess(key) {
			upsertCheckin(key, { status: 'success', cigs: 0 })
			this.refresh()
		},
		addSmoke(key) {
			const item = this.checkins[key]
			const current = Number(item && item.cigs) || 0
			const next = current + 1
			const firstBreak = !item || (item.status !== 'fail' && item.status !== 'relapse')

			const apply = () => {
				upsertCheckin(key, { status: 'fail', cigs: next })
				this.refresh()
				uni.showToast({
					title: firstBreak ? `已吸烟 · ${next} 支` : `今天 ${next} 支`,
					icon: 'none'
				})
			}

			this.openConfirm({
				title: firstBreak ? '记录吸烟？' : '再记一支？',
				content: firstBreak
					? (key === this.today
						? '今天将记为已吸烟，连续天数中断，并从 1 支开始计数。'
						: `${key} 将记为已吸烟，并从 1 支开始计数。`)
					: `当前已记 ${current} 支，确认再加 1 支？`,
				confirmText: firstBreak ? '确认记录' : '再加一支',
				cancelText: '取消',
				tone: 'danger',
				onConfirm: apply
			})
		},
		onSealTap() {
			if (this.todayStatus === 'empty') {
				this.markSuccess(this.today)
				uni.showToast({ title: '今日未抽', icon: 'none' })
				return
			}
			this.addSmoke(this.today)
		},
		recoverToday() {
			this.openConfirm({
				title: '改回未抽？',
				content: `今天已记 ${this.todayCigs} 支。改回后支数清零，连续会重新接上。`,
				confirmText: '改回未抽',
				cancelText: '取消',
				tone: 'calm',
				onConfirm: () => {
					this.markSuccess(this.today)
					uni.showToast({ title: '已改回未抽', icon: 'none' })
				}
			})
		},
		describeDay(key, status, cigs) {
			if (status === 'success') return '状态：未抽'
			if (status === 'fail') return `状态：已吸 ${cigs} 支烟`
			return '状态：未记录'
		},
		formatDayTitle(key) {
			const [y, m, d] = String(key || '').split('-')
			if (!y || !m) return key
			return d ? `${y}-${m}-${d}` : `${y}-${m}`
		},
		openDayActions(key, status, cigs) {
			if (status === 'empty') {
				this.openSheet({
					title: '修改记录',
					content: key,
					actions: [
						{ label: '记为未抽', primary: true, key: 'success' },
						{ label: '记录吸烟', danger: true, key: 'smoke' }
					],
					onAction: ({ item }) => {
						if (item.key === 'success') {
							this.markSuccess(key)
							uni.showToast({ title: '已记为未抽', icon: 'none' })
						}
						if (item.key === 'smoke') this.addSmoke(key)
					}
				})
				return
			}

			if (status === 'success') {
				this.openSheet({
					title: '修改记录',
					content: `${key} · 当前：未抽`,
					actions: [
						{ label: '改为已吸烟', danger: true, key: 'smoke' },
						{ label: '清除记录', key: 'clear' }
					],
					onAction: ({ item }) => {
						if (item.key === 'smoke') this.addSmoke(key)
						if (item.key === 'clear') {
							removeCheckin(key)
							this.refresh()
							uni.showToast({ title: '已清除', icon: 'none' })
						}
					}
				})
				return
			}

			this.openSheet({
				title: '修改记录',
				content: `${key} · 已吸烟 ${cigs} 支`,
				actions: [
					{ label: `再记一支（当前 ${cigs}）`, danger: true, key: 'smoke' },
					{ label: '改回未抽', primary: true, key: 'success' },
					{ label: '清除记录', key: 'clear' }
				],
				onAction: ({ item }) => {
					if (item.key === 'smoke') this.addSmoke(key)
					if (item.key === 'success') {
						this.markSuccess(key)
						uni.showToast({ title: '已改回未抽', icon: 'none' })
					}
					if (item.key === 'clear') {
						removeCheckin(key)
						this.refresh()
						uni.showToast({ title: '已清除', icon: 'none' })
					}
				}
			})
		},
		onDayTap({ key }) {
			if (key > this.today) {
				uni.showToast({ title: '还没到这一天', icon: 'none' })
				return
			}
			const status = statusOf(this.checkins, key)
			const cigs = cigsOf(this.checkins, key)
			// 轻点只看状态；要改请长按
			this.openConfirm({
				title: this.formatDayTitle(key),
				content: `${this.describeDay(key, status, cigs)}\n\n长按日期可修改记录`,
				confirmText: '知道了',
				cancelText: '',
				tone: status === 'fail' ? 'danger' : 'calm',
				onConfirm: null
			})
		},
		onDayLongpress({ key }) {
			if (key > this.today) {
				uni.showToast({ title: '还没到这一天', icon: 'none' })
				return
			}
			const status = statusOf(this.checkins, key)
			const cigs = cigsOf(this.checkins, key)
			this.openDayActions(key, status, cigs)
		}
	}
}
</script>

<style lang="scss" scoped>
@import '../../common/theme.scss';

.home {
	position: relative;
	flex: 1;
	min-height: 100vh;
	min-height: 100dvh;
}

.content {
	flex: 1;
	min-height: 100%;
	display: flex;
	flex-direction: column;
	box-sizing: border-box;
}

.fiber {
	position: absolute;
	pointer-events: none;
	opacity: 0.3;
	border-radius: 999px;
	transform: rotate(-18deg);
	background: linear-gradient(90deg, transparent, rgba(70, 78, 88, 0.2), transparent);
}
.fiber-a {
	width: 140%;
	height: 2rpx;
	left: -20%;
	top: 160rpx;
}
.fiber-b {
	width: 120%;
	height: 2rpx;
	left: -10%;
	top: 420rpx;
	transform: rotate(12deg);
	opacity: 0.22;
}

.topbar {
	padding-top: 36rpx;
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
}

.brand {
	display: block;
	font-size: 88rpx;
	line-height: 1;
	font-weight: 700;
	letter-spacing: 12rpx;
	color: $ink;
	font-family: 'Songti SC', 'STSong', 'Noto Serif SC', 'PingFang SC', serif;
}

.brand-en {
	display: block;
	margin-top: 14rpx;
	font-size: 22rpx;
	letter-spacing: 6rpx;
	color: $mute;
}

.gear {
	margin-top: 4rpx;
	min-width: 96rpx;
	min-height: 96rpx;
	padding: 16rpx 20rpx 12rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 8rpx;
	position: relative;
	z-index: 5;
}

.gear-hover {
	opacity: 0.7;
}

.gear-ring {
	width: 44rpx;
	height: 44rpx;
	border: 3rpx solid $ink;
	border-radius: 50%;
	opacity: 0.7;
}

.gear-core {
	position: absolute;
	top: 30rpx;
	width: 14rpx;
	height: 14rpx;
	border-radius: 50%;
	background: $ink;
	opacity: 0.7;
}

.gear-text {
	font-size: 22rpx;
	color: $ink-soft;
	letter-spacing: 2rpx;
}

.quote {
	margin-top: 24rpx;
}

.quote-line {
	display: block;
	font-size: 30rpx;
	line-height: 1.6;
	color: $ink-soft;
	font-family: 'Songti SC', 'STSong', 'Noto Serif SC', 'PingFang SC', serif;
}

.quote-meta {
	display: block;
	margin-top: 14rpx;
	font-size: 24rpx;
	color: $mute;
	letter-spacing: 2rpx;
}

.seal-wrap {
	margin-top: auto;
	padding-top: 28rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12rpx;
	padding-bottom: 20rpx;
}

.seal {
	width: 220rpx;
	height: 220rpx;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(255, 255, 255, 0.45);
	border: 1px solid rgba(74, 93, 106, 0.22);
}

.seal-ring {
	width: 184rpx;
	height: 184rpx;
	border-radius: 50%;
	border: 3rpx solid $seal;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	background: rgba(242, 241, 238, 0.65);
}

.seal.done .seal-ring {
	background: $seal;
	border-color: $seal;
}

.seal.fail .seal-ring {
	background: $coral;
	border-color: $coral;
}

.seal-main {
	font-size: 44rpx;
	font-weight: 700;
	letter-spacing: 4rpx;
	color: $ink;
	font-family: 'Songti SC', 'STSong', 'PingFang SC', serif;
}

.seal-sub {
	margin-top: 4rpx;
	font-size: 22rpx;
	letter-spacing: 4rpx;
	color: $mute;
}

.seal.done .seal-main,
.seal.done .seal-sub,
.seal.fail .seal-main,
.seal.fail .seal-sub {
	color: $paper;
}

.seal-tip {
	font-size: 22rpx;
	color: $mute;
	letter-spacing: 1rpx;
	text-align: center;
}

.notify-soft {
	margin-top: 8rpx;
	font-size: 22rpx;
	color: $coral;
	letter-spacing: 1rpx;
	text-align: center;
	text-decoration: underline;
}

.recover {
	margin-top: 8rpx;
	font-size: 26rpx;
	color: $seal;
	letter-spacing: 2rpx;
	font-weight: 700;
	text-decoration: underline;
}
</style>
