<template>
	<!-- 全屏覆盖在首页之上，避免第二页 webview 白屏 -->
	<view class="settings-mask" :class="{ in: appear }">
		<view class="settings-shell" :class="{ in: appear }">
			<view class="content">
				<view class="nav-space"></view>

				<view class="lead">
					<text class="lead-title">设置</text>
					<text class="lead-desc">提醒、权限与打卡数据。</text>
				</view>

				<view class="sheet">
					<text class="block-title">提醒</text>
					<view class="row between">
						<text class="label">每日提醒</text>
						<switch :checked="profile.reminderEnabled" color="#4A5D6A" @change="toggleReminder" />
					</view>
					<text v-if="profile.reminderEnabled && !status.notificationsEnabled" class="warn-line">
						通知权限未开，到点可能收不到提醒
					</text>

					<view
						class="remind-panel"
						:class="{ open: remindOpen }"
						:style="{ height: remindOpen ? remindHeight + 'px' : '0px' }"
					>
						<view class="remind-inner">
							<view
								class="time-row"
								v-for="(t, i) in profile.reminderTimes"
								:key="i"
							>
								<picker mode="time" :value="t" @change="onTimePicked(i, $event)">
									<view class="time-pick">
										<text class="time-value">{{ t }}</text>
									</view>
								</picker>
								<view class="time-del" @click.stop="confirmRemoveTime(i)">
									<text class="del-text">删除</text>
								</view>
							</view>

							<view class="ops">
								<text class="op" @click="addTime" v-if="profile.reminderTimes.length < 5">添加时间</text>
								<text class="op" @click="testNotify">测试通知</text>
								<text class="op" @click="testTimedRemind">1分钟后测定时</text>
							</view>
						</view>
					</view>
				</view>

				<view class="sheet">
					<text class="block-title">权限</text>
					<view class="perm-row" @click="openNotifyPermission">
						<view class="perm-left">
							<text class="perm-name">通知权限</text>
							<text class="perm-desc">用于到点在通知栏提醒打卡</text>
						</view>
						<view class="perm-right">
							<text class="perm-state" :class="{ ok: status.notificationsEnabled }">
								{{ status.notificationsEnabled ? '已开启' : '未开启' }}
							</text>
							<text class="perm-arrow">›</text>
						</view>
					</view>
					<view class="perm-row" @click="openExactPermission">
						<view class="perm-left">
							<text class="perm-name">准时提醒</text>
							<text class="perm-desc">系统精确闹钟权限，到点更准</text>
						</view>
						<view class="perm-right">
							<text class="perm-state" :class="{ ok: status.exactAlarm }">
								{{ status.exactAlarm ? '已开启' : '未开启' }}
							</text>
							<text class="perm-arrow">›</text>
						</view>
					</view>
					<view class="perm-row" @click="openBatteryPermission">
						<view class="perm-left">
							<text class="perm-name">后台运行</text>
							<text class="perm-desc">忽略电池优化，降低提醒被系统杀掉的概率</text>
						</view>
						<view class="perm-right">
							<text class="perm-state" :class="{ ok: status.batteryOk }">
								{{ status.batteryOk ? '已忽略' : '去设置' }}
							</text>
							<text class="perm-arrow">›</text>
						</view>
					</view>
					<view v-if="status.xiaomi" class="xiaomi-tip">
						<text class="xiaomi-text">
							小米 / Redmi 建议按顺序检查：
							1）通知权限 2）准时提醒 3）忽略电池优化 4）应用详情里打开「自启动」「后台弹出界面」。
							重启手机后请再打开一次本 App，以便重挂提醒。
						</text>
						<text class="xiaomi-link" @click="openAppDetails">打开应用详情</text>
					</view>
					<view class="perm-row" @click="runReminderHealthCheck">
						<view class="perm-left">
							<text class="perm-name">检查提醒状态</text>
							<text class="perm-desc">查看权限并重新预约下次提醒</text>
						</view>
						<text class="perm-arrow">›</text>
					</view>
				</view>

				<view class="sheet">
					<text class="block-title">备份</text>
					<view class="row between">
						<text class="label">自动本地备份</text>
						<switch :checked="profile.backupEnabled" color="#4A5D6A" @change="toggleBackup" />
					</view>
					<text class="backup-hint">写入 App 私有目录，最多保留 8 份。周期可按天设置。</text>
					<view v-if="profile.backupEnabled" class="backup-row">
						<text class="backup-label">备份周期</text>
						<view class="backup-days">
							<text
								v-for="d in backupDayOptions"
								:key="d"
								class="day-chip"
								:class="{ on: profile.backupIntervalDays === d }"
								@click="setBackupDays(d)"
							>{{ d }}天</text>
						</view>
					</view>
					<text class="backup-meta">上次：{{ backupStatus.lastText }}</text>
					<view class="action-row" @click="runManualBackup">
						<view class="perm-left">
							<text class="perm-name">立即备份</text>
							<text class="perm-desc">马上写一份到本地备份目录</text>
						</view>
						<text class="perm-arrow">›</text>
					</view>
				</view>

				<view class="sheet">
					<text class="block-title">数据</text>
					<view class="action-row" @click="chooseExportMode">
						<view class="perm-left">
							<text class="perm-name">导出打卡记录</text>
							<text class="perm-desc">普通 JSON，或密码加密后导出</text>
						</view>
						<text class="perm-arrow">›</text>
					</view>
					<view class="action-row" @click="importCheckins">
						<view class="perm-left">
							<text class="perm-name">导入打卡记录</text>
							<text class="perm-desc">支持明文或加密 JSON</text>
						</view>
						<text class="perm-arrow">›</text>
					</view>
				</view>

				<view class="danger" @click="clearCheckins">
					<text>清空全部打卡记录</text>
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
	</view>
</template>

<script>
import PaperDialog from './PaperDialog.vue'
import paperDialogMixin from '../mixins/paperDialog.js'
import { getProfile, saveProfile, saveCheckins, flushCheckins, getMeta, saveMeta } from '../utils/storage.js'
import { normalizeReminderTimes } from '../utils/times.js'
import {
	scheduleReminders,
	sendTestNotification,
	cancelAllReminders,
	scheduleTestReminderInMinutes,
	ensureRemindersAlive
} from '../utils/notify.js'
import {
	ensureReminderPermissions,
	askNotificationAccess,
	openAppNotificationSettings,
	openExactAlarmSettings,
	openAppDetailsSettings,
	areNotificationsEnabled,
	canScheduleExactAlarms,
	isIgnoringBatteryOptimizations,
	requestIgnoreBatteryOptimizations,
	isXiaomiFamily
} from '../utils/permissions.js'
import {
	exportAndShareCheckins,
	pickAndParseCheckinJson,
	parseEncryptedCheckinJson,
	mergeImportedCheckins,
	replaceImportedCheckins
} from '../utils/export.js'
import {
	createLocalBackup,
	formatBackupStatus,
	normalizeBackupDays
} from '../utils/backup.js'
import { paintSystemBars } from '../utils/systemui.js'

export default {
	name: 'SettingsPanel',
	components: { PaperDialog },
	mixins: [paperDialogMixin],
	emits: ['checkins-changed', 'closed'],
	data() {
		return {
			appear: false,
			closing: false,
			profile: getProfile(),
			status: {
				notificationsEnabled: true,
				exactAlarm: true,
				batteryOk: true,
				xiaomi: false
			},
			remindOpen: false,
			remindHeight: 0,
			backupDayOptions: [1, 3, 7, 14, 30],
			backupStatus: formatBackupStatus()
		}
	},
	mounted() {
		paintSystemBars()
		this.boot()
		this.$nextTick(() => {
			setTimeout(() => { this.appear = true }, 16)
		})
	},
	beforeUnmount() {
		flushCheckins()
	},
	watch: {
		'profile.reminderTimes': {
			deep: true,
			handler() {
				if (!this.remindOpen) return
				this.$nextTick(() => this.measureRemindPanel())
			}
		}
	},
	methods: {
		/** 供首页系统返回：先淡出再卸载 */
		beginClose() {
			if (this.closing) return
			this.closing = true
			this.appear = false
			setTimeout(() => {
				this.$emit('closed')
			}, 220)
		},
		async boot() {
			this.profile = getProfile()
			this.remindOpen = !!this.profile.reminderEnabled
			this.backupStatus = formatBackupStatus()
			await this.refreshStatus()
			this.$nextTick(() => this.measureRemindPanel())
		},
		promptText({ title, placeholder = '', confirmText = '确定' }) {
			return new Promise((resolve) => {
				uni.showModal({
					title,
					editable: true,
					placeholderText: placeholder,
					confirmText,
					cancelText: '取消',
					success: (res) => {
						if (!res.confirm) {
							resolve(null)
							return
						}
						resolve(String(res.content != null ? res.content : (res.value || '')).trim())
					},
					fail: () => resolve(null)
				})
			})
		},
		toggleBackup(e) {
			const on = !!e.detail.value
			this.profile = saveProfile({ backupEnabled: on })
			this.backupStatus = formatBackupStatus()
			uni.showToast({
				title: on ? `已开启 · 每 ${this.profile.backupIntervalDays} 天` : '已关闭自动备份',
				icon: 'none'
			})
		},
		setBackupDays(days) {
			const next = normalizeBackupDays(days)
			this.profile = saveProfile({ backupIntervalDays: next, backupEnabled: true })
			this.backupStatus = formatBackupStatus()
			uni.showToast({ title: `周期已设为 ${next} 天`, icon: 'none' })
		},
		async runManualBackup() {
			uni.showLoading({ title: '正在备份', mask: true })
			try {
				const res = await createLocalBackup({ reason: 'manual' })
				uni.hideLoading()
				this.backupStatus = formatBackupStatus()
				if (!res.ok) {
					uni.showToast({ title: res.message || '备份失败', icon: 'none' })
					return
				}
				this.showDataSummary({
					title: '备份完成',
					lines: [
						res.message || `已备份 ${res.count} 条`,
						res.fileName ? `文件：${res.fileName}` : '',
						'可在设置中调整自动备份周期。'
					].filter(Boolean)
				})
			} catch (e) {
				uni.hideLoading()
				uni.showToast({ title: '备份失败', icon: 'none' })
			}
		},
		chooseExportMode() {
			this.openSheet({
				title: '导出方式',
				content: '加密导出需设置密码，导入时输入同一密码即可还原。',
				actions: [
					{ label: '普通导出', primary: true, key: 'plain' },
					{ label: '加密导出（密码保护）', key: 'encrypted' }
				],
				onAction: ({ item }) => {
					if (item.key === 'plain') this.exportCheckins('')
					if (item.key === 'encrypted') this.exportEncrypted()
				}
			})
		},
		async exportEncrypted() {
			const pwd = await this.promptText({
				title: '设置导出密码',
				placeholder: '至少 4 位',
				confirmText: '继续'
			})
			if (pwd == null) return
			if (pwd.length < 4) {
				uni.showToast({ title: '密码至少 4 位', icon: 'none' })
				return
			}
			const again = await this.promptText({
				title: '再输入一次密码',
				placeholder: '确认密码',
				confirmText: '导出'
			})
			if (again == null) return
			if (again !== pwd) {
				uni.showToast({ title: '两次密码不一致', icon: 'none' })
				return
			}
			this.exportCheckins(pwd)
		},
		buildSetupGuideContent() {
			const lines = [
				'打开提醒后，需要依次确认这些权限，否则到点可能收不到：',
				'1. 通知权限 — 允许弹出通知',
				'2. 准时提醒 — 允许精确闹钟',
				'3. 后台运行 — 忽略电池优化'
			]
			if (isXiaomiFamily()) {
				lines.push('4. 小米：应用详情中打开「自启动」「后台弹出界面」')
				lines.push('重启手机后请再打开一次本 App，以便重挂提醒。')
			}
			lines.push('接下来会依次跳转系统页，请全部允许。')
			return lines.join('\n')
		},
		async applyReminderOn() {
			const times = normalizeReminderTimes(this.profile.reminderTimes || [])
			const reminderTimes = times.length ? times : ['09:00', '20:00']
			this.profile = {
				...this.profile,
				reminderEnabled: true,
				reminderTimes
			}
			this.remindOpen = true
			this.$nextTick(() => this.measureRemindPanel())
			saveProfile({ reminderEnabled: true, reminderTimes })

			await askNotificationAccess()
			if (!canScheduleExactAlarms()) {
				openExactAlarmSettings()
				await new Promise((r) => setTimeout(r, 600))
			}
			try {
				if (!isIgnoringBatteryOptimizations()) {
					requestIgnoreBatteryOptimizations()
					await new Promise((r) => setTimeout(r, 600))
				}
			} catch (err) {}
			if (isXiaomiFamily() && !getMeta().xiaomiAutostartHintShown) {
				saveMeta({ xiaomiAutostartHintShown: true })
				// 给用户一个明确入口，不强制打断太多次
				setTimeout(() => {
					this.openConfirm({
						title: '还差一步（小米）',
						content: '请在应用详情中打开「自启动」和「后台弹出界面」，否则杀进程或重启后提醒可能失效。',
						confirmText: '去设置',
						cancelText: '稍后',
						tone: 'calm',
						onConfirm: () => openAppDetailsSettings()
					})
				}, 400)
			}

			await this.refreshStatus()
			const res = scheduleReminders(true, { ensureExact: true })
			saveMeta({ reminderSetupShown: true })
			this.showReminderSetupResult(res)
		},
		showReminderSetupResult(res) {
			const s = this.status
			const lines = [
				`通知：${s.notificationsEnabled ? '已开' : '未开'}`,
				`准时提醒：${s.exactAlarm ? '已开' : '未开'}`,
				`后台运行：${s.batteryOk ? '已忽略优化' : '未忽略'}`,
			]
			if (res && res.scheduled && res.scheduled[0]) {
				lines.push(`下次提醒：${res.scheduled[0].label}`)
			} else if (!s.notificationsEnabled) {
				lines.push('尚未预约成功，请先打开通知权限后点「检查提醒状态」。')
			} else {
				lines.push('已按当前时间表尝试预约。')
			}
			this.openConfirm({
				title: '提醒已开启',
				content: lines.join('\n'),
				confirmText: '知道了',
				cancelText: '',
				tone: 'calm',
				onConfirm: null
			})
		},
		async runReminderHealthCheck() {
			await this.refreshStatus()
			ensureRemindersAlive()
			const res = scheduleReminders(true, { ensureExact: true })
			const s = this.status
			const lines = [
				`每日提醒：${this.profile.reminderEnabled ? '开' : '关'}`,
				`通知：${s.notificationsEnabled ? '已开' : '未开'}`,
				`准时提醒：${s.exactAlarm ? '已开' : '未开'}`,
				`后台运行：${s.batteryOk ? '已忽略优化' : '未忽略'}`,
			]
			if (!this.profile.reminderEnabled) {
				lines.push('当前未开启每日提醒。')
			} else if (res && res.scheduled && res.scheduled[0]) {
				lines.push(`下次提醒：${res.scheduled[0].label}`)
				lines.push('已重新预约。')
			} else if (res && res.needNotifyPermission) {
				lines.push('请先开启通知权限。')
			} else {
				lines.push('暂无可用提醒时间，请先添加时间。')
			}
			if (s.xiaomi) {
				lines.push('小米用户：确认自启动与后台弹出已开；重启后请再进一次 App。')
			}
			this.openConfirm({
				title: '提醒状态',
				content: lines.join('\n'),
				confirmText: '知道了',
				cancelText: '',
				tone: 'calm',
				onConfirm: null
			})
		},
		measureRemindPanel() {
			uni.createSelectorQuery()
				.in(this)
				.select('.remind-inner')
				.boundingClientRect((rect) => {
					if (!rect) return
					this.remindHeight = Math.ceil(rect.height || 0)
				})
				.exec()
		},
		async refreshStatus() {
			this.status = await ensureReminderPermissions()
		},
		persist(partial) {
			this.profile = saveProfile(partial)
			scheduleReminders(true, { ensureExact: !!partial.reminderEnabled || this.profile.reminderEnabled })
		},
		async toggleReminder(e) {
			const on = !!e.detail.value
			if (on) {
				const firstTime = !getMeta().reminderSetupShown
				if (firstTime) {
					// 先回弹开关 UI，等用户确认引导后再真正打开
					this.profile = { ...this.profile, reminderEnabled: false }
					this.$nextTick(() => {
						this.openConfirm({
							title: '开启每日提醒',
							content: this.buildSetupGuideContent(),
							confirmText: '开始设置',
							cancelText: '取消',
							tone: 'calm',
							onConfirm: () => {
								setTimeout(() => this.applyReminderOn(), 220)
							}
						})
					})
					return
				}
				this.profile = { ...this.profile, reminderEnabled: true }
				this.remindOpen = true
				this.$nextTick(() => this.measureRemindPanel())
				setTimeout(() => this.applyReminderOn(), 200)
				return
			}
			this.remindOpen = false
			this.profile = { ...this.profile, reminderEnabled: false }
			setTimeout(() => {
				this.persist({ reminderEnabled: false })
				cancelAllReminders()
			}, 320)
		},
		onTimePicked(idx, e) {
			const v = String((e && e.detail && e.detail.value) || '').trim()
			if (!/^\d{1,2}:\d{2}$/.test(v)) return
			const times = [...(this.profile.reminderTimes || [])]
			const [h, m] = v.split(':')
			const next = `${String(h).padStart(2, '0')}:${m}`
			if (times.some((t, i) => i !== idx && t === next)) {
				uni.showToast({ title: '该时间已存在', icon: 'none' })
				return
			}
			times[idx] = next
			this.persist({ reminderTimes: normalizeReminderTimes(times) })
		},
		addTime() {
			const times = [...(this.profile.reminderTimes || [])]
			if (times.length >= 5) return
			let candidate = '12:00'
			const presets = ['08:00', '12:00', '18:00', '20:00', '22:00']
			for (const p of presets) {
				if (!times.includes(p)) {
					candidate = p
					break
				}
			}
			times.push(candidate)
			this.persist({ reminderTimes: normalizeReminderTimes(times), reminderEnabled: true })
		},
		confirmRemoveTime(idx) {
			const times = this.profile.reminderTimes || []
			const t = times[idx] || ''
			const lastOne = times.length <= 1
			this.openConfirm({
				title: '删除这个提醒？',
				content: lastOne
					? `删除 ${t} 后将没有提醒时间，每日提醒会自动关闭。`
					: `确认删除 ${t} 的通知提醒？`,
				confirmText: '删除',
				cancelText: '取消',
				tone: 'danger',
				onConfirm: () => this.removeTime(idx)
			})
		},
		removeTime(idx) {
			const times = [...(this.profile.reminderTimes || [])]
			times.splice(idx, 1)
			if (!times.length) {
				this.remindOpen = false
				this.persist({ reminderTimes: [], reminderEnabled: false })
				cancelAllReminders()
				uni.showToast({ title: '已关闭提醒', icon: 'none' })
				return
			}
			this.persist({ reminderTimes: times })
		},
		async openNotifyPermission() {
			if (areNotificationsEnabled()) {
				openAppNotificationSettings()
			} else {
				await askNotificationAccess()
			}
			await this.refreshStatus()
		},
		async openExactPermission() {
			openExactAlarmSettings()
			setTimeout(() => this.refreshStatus(), 800)
		},
		openBatteryPermission() {
			if (isIgnoringBatteryOptimizations()) {
				uni.showToast({ title: '已忽略电池优化', icon: 'none' })
				return
			}
			requestIgnoreBatteryOptimizations()
			setTimeout(() => this.refreshStatus(), 800)
		},
		openAppDetails() {
			openAppDetailsSettings()
		},
		async testNotify() {
			await askNotificationAccess()
			const ok = sendTestNotification()
			uni.showToast({ title: ok ? '已发送到通知栏' : '发送失败，请检查通知权限', icon: 'none' })
			this.refreshStatus()
		},
		testTimedRemind() {
			if (!this.profile.reminderEnabled) {
				uni.showToast({ title: '请先打开每日提醒', icon: 'none' })
				return
			}
			if (!canScheduleExactAlarms()) {
				openExactAlarmSettings()
			}
			const res = scheduleTestReminderInMinutes(1)
			uni.showToast({
				title: res.ok
					? `${res.message}。可先留在本页等 1 分钟，或退到桌面等通知。`
					: (res.message || '安排失败'),
				icon: 'none',
				duration: 3500
			})
		},
		showDataSummary({ title, lines }) {
			this.openConfirm({
				title,
				content: lines.join('\n'),
				confirmText: '知道了',
				cancelText: '',
				tone: 'calm',
				onConfirm: null
			})
		},
		async exportCheckins(password = '') {
			uni.showLoading({ title: password ? '正在加密导出' : '正在导出', mask: true })
			try {
				const res = await exportAndShareCheckins({ password })
				uni.hideLoading()
				if (!res.ok) {
					uni.showToast({ title: res.message || '导出失败', icon: 'none' })
					return
				}
				const modeText = res.mode === 'download'
					? '已下载到本地'
					: (res.mode === 'intent-file' || res.mode === 'system-file')
						? '已生成文件并打开分享'
						: '导出完成'
				this.showDataSummary({
					title: res.encrypted ? '加密导出完成' : '导出完成',
					lines: [
						`共导出 ${res.count} 条打卡记录`,
						res.encrypted ? '文件已密码保护，请牢记密码' : '未加密明文 JSON',
						modeText,
						res.fileName ? `文件：${res.fileName}` : '',
						res.message ? String(res.message) : ''
					].filter(Boolean)
				})
			} catch (e) {
				uni.hideLoading()
				uni.showToast({ title: '导出失败，请重试', icon: 'none' })
			}
		},
		openImportChooser(checkins, count) {
			this.openSheet({
				title: '选择导入方式',
				content: `文件含 ${count} 条记录。\n合并：同日期以文件为准，其余保留。\n覆盖：先清空本地再导入，不可恢复。`,
				actions: [
					{ label: '合并导入', primary: true, key: 'merge' },
					{ label: '全部覆盖（危险）', danger: true, key: 'replace' }
				],
				onAction: ({ item }) => {
					if (item.key === 'merge') {
						const res = mergeImportedCheckins(checkins)
						this.$emit('checkins-changed')
						this.showDataSummary({
							title: '合并完成',
							lines: [
								`写入 ${res.imported} 条（未抽 ${res.importedSuccess} · 吸烟日 ${res.importedFail}）`,
								`当前总计 ${res.total} 条（未抽 ${res.success} · 吸烟日 ${res.fail} · ${res.cigs} 支）`
							]
						})
						return
					}
					if (item.key === 'replace') {
						this.openConfirm({
							title: '确认全部覆盖？',
							content: `将删除本地全部打卡，再写入这 ${count} 条。此操作不可恢复。`,
							confirmText: '覆盖',
							cancelText: '取消',
							tone: 'danger',
							onConfirm: () => {
								const res = replaceImportedCheckins(checkins)
								this.$emit('checkins-changed')
								this.showDataSummary({
									title: '覆盖完成',
									lines: [
										`现为 ${res.total} 条记录`,
										`未抽 ${res.success} 天 · 吸烟日 ${res.fail} 天 · 共 ${res.cigs} 支`
									]
								})
							}
						})
					}
				}
			})
		},
		async importCheckins() {
			try {
				const picked = await pickAndParseCheckinJson()
				if (picked && picked.needPassword) {
					const pwd = await this.promptText({
						title: '输入解密密码',
						placeholder: '加密导出时设置的密码',
						confirmText: '解密'
					})
					if (pwd == null) return
					const decoded = await parseEncryptedCheckinJson(picked.raw, pwd)
					this.openImportChooser(decoded.checkins, decoded.count)
					return
				}
				this.openImportChooser(picked.checkins, picked.count)
			} catch (e) {
				const msg = String((e && e.message) || e || '')
				if (msg === 'cancelled') return
				uni.showToast({ title: msg || '导入失败', icon: 'none' })
			}
		},
		clearCheckins() {
			this.openConfirm({
				title: '清空打卡？',
				content: '日历上的打卡记录会全部删除，提醒设置保留。此操作不可恢复。',
				confirmText: '清空',
				cancelText: '取消',
				tone: 'danger',
				onConfirm: () => {
					saveCheckins({})
					this.$emit('checkins-changed')
					this.showDataSummary({
						title: '已清空',
						lines: ['全部打卡记录已删除。', '提醒设置仍保留。']
					})
				}
			})
		}
	}
}
</script>

<style lang="scss" scoped>
@import '../common/theme.scss';

.settings-mask {
	position: fixed;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	z-index: 2000;
	background: $paper;
	opacity: 0;
	transition: opacity 0.22s ease;
}

.settings-mask.in {
	opacity: 1;
}

.settings-shell {
	position: relative;
	height: 100%;
	min-height: 100%;
	@include paper-surface;
	background-color: $paper;
	opacity: 0;
	transform: translateY(12rpx);
	transition: opacity 0.22s ease, transform 0.22s ease;
}

.settings-shell.in {
	opacity: 1;
	transform: translateY(0);
}

.content {
	position: relative;
	z-index: 2;
	width: 100%;
	height: 100%;
	overflow-y: auto;
	padding: 0 44rpx;
	padding-bottom: constant(safe-area-inset-bottom);
	padding-bottom: var(--app-safe-bottom, env(safe-area-inset-bottom, 0px));
	box-sizing: border-box;
}

.lead {
	margin-top: 16rpx;
}

.lead-title {
	display: block;
	font-size: 56rpx;
	letter-spacing: 8rpx;
	font-weight: 700;
	color: $ink;
	font-family: 'Songti SC', 'STSong', 'PingFang SC', serif;
}

.lead-desc {
	display: block;
	margin-top: 14rpx;
	font-size: 28rpx;
	color: $mute;
	line-height: 1.6;
}

.backup-hint,
.backup-meta {
	display: block;
	margin-top: 14rpx;
	font-size: 24rpx;
	color: $mute;
	line-height: 1.5;
}

.backup-row {
	margin-top: 20rpx;
}

.backup-label {
	display: block;
	font-size: 26rpx;
	color: $ink-soft;
	margin-bottom: 12rpx;
}

.backup-days {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}

.day-chip {
	min-width: 88rpx;
	height: 56rpx;
	padding: 0 16rpx;
	border-radius: 6rpx;
	border: 1px solid rgba(70, 78, 88, 0.16);
	background: rgba(255, 255, 255, 0.55);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 24rpx;
	color: $ink-soft;
}

.day-chip.on {
	background: rgba(74, 93, 106, 0.12);
	border-color: rgba(74, 93, 106, 0.45);
	color: $seal;
	font-weight: 700;
}

.sheet {
	margin-top: 32rpx;
	padding: 28rpx;
	background: rgba(255, 255, 255, 0.72);
	border: 1px solid rgba(70, 78, 88, 0.12);
	border-radius: 4rpx;
}

.row.between {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
}

.label {
	font-size: 30rpx;
	color: $ink;
	font-weight: 600;
}

.time-row {
	margin-top: 20rpx;
	padding: 16rpx 12rpx 16rpx 24rpx;
	background: rgba(236, 237, 239, 0.7);
	border: 1px dashed rgba(70, 78, 88, 0.16);
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16rpx;
}

.time-pick {
	min-height: 72rpx;
	display: flex;
	align-items: center;
	padding-right: 16rpx;
	flex: 1;
}

.time-value {
	font-size: 52rpx;
	letter-spacing: 4rpx;
	color: $ink;
	font-weight: 700;
	font-family: 'Songti SC', 'STSong', 'PingFang SC', serif;
}

.time-del {
	min-width: 112rpx;
	height: 64rpx;
	padding: 0 22rpx;
	border-radius: 6rpx;
	background: rgba(154, 91, 74, 0.12);
	border: 1px solid rgba(154, 91, 74, 0.35);
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.time-del:active { opacity: 0.85; }

.del-text {
	font-size: 26rpx;
	color: $coral;
	font-weight: 700;
	letter-spacing: 2rpx;
}

.ops {
	margin-top: 28rpx;
	display: flex;
	flex-wrap: wrap;
	gap: 28rpx;
}

.op {
	font-size: 26rpx;
	color: $seal;
	font-weight: 700;
	letter-spacing: 2rpx;
}

.block-title {
	display: block;
	font-size: 30rpx;
	font-weight: 700;
	letter-spacing: 4rpx;
	color: $ink;
	margin-bottom: 16rpx;
}

.warn-line {
	display: block;
	margin-top: 16rpx;
	font-size: 24rpx;
	color: $coral;
	line-height: 1.5;
}

.remind-panel {
	height: 0;
	opacity: 0;
	overflow: hidden;
	transform: translateZ(0);
	transition:
		height 0.36s ease,
		opacity 0.28s ease;
}

.remind-panel.open { opacity: 1; }
.remind-inner { padding-top: 4rpx; }

.perm-row,
.action-row {
	margin-top: 12rpx;
	padding: 20rpx 4rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16rpx;
}

.perm-left {
	display: flex;
	flex-direction: column;
	gap: 6rpx;
	min-width: 0;
}

.perm-name {
	font-size: 30rpx;
	color: $ink;
	font-weight: 600;
}

.perm-desc {
	font-size: 24rpx;
	color: $mute;
}

.perm-right {
	display: flex;
	align-items: center;
	gap: 8rpx;
	flex-shrink: 0;
}

.perm-state {
	font-size: 26rpx;
	color: $coral;
	font-weight: 600;
}

.perm-state.ok { color: $seal; }

.perm-arrow {
	font-size: 36rpx;
	color: $mute;
	line-height: 1;
}

.xiaomi-tip {
	margin-top: 12rpx;
	padding: 18rpx 16rpx;
	background: rgba(74, 93, 106, 0.06);
	border: 1px dashed rgba(74, 93, 106, 0.22);
}

.xiaomi-text {
	display: block;
	font-size: 24rpx;
	line-height: 1.55;
	color: $ink-soft;
}

.xiaomi-link {
	display: inline-block;
	margin-top: 12rpx;
	font-size: 24rpx;
	color: $seal;
	font-weight: 700;
	text-decoration: underline;
}

.danger {
	margin-top: 32rpx;
	min-height: 88rpx;
	padding: 0 20rpx;
	border: 1px solid rgba(154, 91, 74, 0.28);
	display: flex;
	align-items: center;
	justify-content: center;
	color: $coral;
	font-size: 28rpx;
	letter-spacing: 4rpx;
	background: rgba(154, 91, 74, 0.06);
}
</style>
