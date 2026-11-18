<template>
	<!-- 关闭时立刻卸掉节点，避免 App WebView 上 opacity:0 仍拦截点击（设置进不去的主因之一） -->
	<view
		v-if="show"
		class="mask"
		:class="{ in: visible }"
		:style="{ pointerEvents: visible ? 'auto' : 'none' }"
		@touchmove.stop.prevent
		@click="onMask"
	>
		<view class="panel" :class="{ in: visible, sheet: isSheet }" @click.stop>
			<template v-if="!isSheet">
				<text class="title">{{ title }}</text>
				<text v-if="content" class="content">{{ content }}</text>
				<view class="btns">
					<view v-if="cancelText" class="btn ghost" @click="onCancel">
						<text>{{ cancelText }}</text>
					</view>
					<view class="btn" :class="tone" @click="onConfirm">
						<text>{{ confirmText || '确定' }}</text>
					</view>
				</view>
			</template>
			<template v-else>
				<text v-if="title" class="sheet-title">{{ title }}</text>
				<text v-if="content" class="sheet-content">{{ content }}</text>
				<view
					v-for="(item, i) in actions"
					:key="i"
					class="action"
					:class="{ danger: item.danger, primary: item.primary }"
					@click="onAction(item, i)"
				>
					<text>{{ item.label }}</text>
				</view>
				<view class="action cancel" @click="onCancel">
					<text>{{ cancelText || '关闭' }}</text>
				</view>
			</template>
		</view>
	</view>
</template>

<script>
export default {
	name: 'PaperDialog',
	props: {
		visible: { type: Boolean, default: false },
		title: { type: String, default: '' },
		content: { type: String, default: '' },
		cancelText: { type: String, default: '取消' },
		confirmText: { type: String, default: '确定' },
		tone: { type: String, default: 'ink' },
		actions: { type: Array, default: () => [] },
		maskClosable: { type: Boolean, default: true }
	},
	data() {
		return {
			show: false,
			hideTimer: null
		}
	},
	computed: {
		isSheet() {
			return Array.isArray(this.actions) && this.actions.length > 0
		}
	},
	watch: {
		visible: {
			immediate: true,
			handler(v) {
				if (this.hideTimer) {
					clearTimeout(this.hideTimer)
					this.hideTimer = null
				}
				if (v) {
					this.show = true
					return
				}
				// 先失活点击，再卸节点（缩短到 180ms，且期间 pointer-events:none）
				this.hideTimer = setTimeout(() => {
					this.hideTimer = null
					if (!this.visible) this.show = false
				}, 180)
			}
		}
	},
	beforeUnmount() {
		if (this.hideTimer) clearTimeout(this.hideTimer)
	},
	methods: {
		onMask() {
			if (!this.visible || !this.maskClosable) return
			this.$emit('cancel')
			this.$emit('close')
		},
		onCancel() {
			this.$emit('cancel')
			this.$emit('close')
		},
		onConfirm() {
			this.$emit('confirm')
			this.$emit('close')
		},
		onAction(item, index) {
			this.$emit('action', { item, index })
			this.$emit('close')
		}
	}
}
</script>

<style lang="scss" scoped>
@import '../common/theme.scss';

.mask {
	position: fixed;
	inset: 0;
	z-index: 1000;
	background: rgba(28, 32, 36, 0.38);
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 48rpx;
	opacity: 0;
	pointer-events: none;
	transition: opacity 0.18s ease;
}

.mask.in {
	opacity: 1;
	pointer-events: auto;
}

.panel {
	width: 100%;
	max-width: 620rpx;
	background:
		linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(242, 241, 238, 0.96));
	border: 1px solid rgba(70, 78, 88, 0.12);
	border-radius: 8rpx;
	box-shadow: 0 24rpx 60rpx rgba(20, 24, 27, 0.16);
	padding: 44rpx 36rpx 28rpx;
	transform: translateY(18rpx) scale(0.98);
	opacity: 0;
	transition: transform 0.2s cubic-bezier(0.22, 0.8, 0.28, 1), opacity 0.2s ease;
}

.panel.in {
	transform: translateY(0) scale(1);
	opacity: 1;
}

.panel.sheet {
	padding: 36rpx 28rpx 20rpx;
}

.title {
	display: block;
	text-align: center;
	font-size: 36rpx;
	font-weight: 700;
	letter-spacing: 2rpx;
	color: #111417;
	font-family: 'Songti SC', 'STSong', 'PingFang SC', serif;
}

.content {
	display: block;
	margin-top: 20rpx;
	text-align: center;
	font-size: 28rpx;
	line-height: 1.65;
	color: #6B737B;
	white-space: pre-wrap;
}

.btns {
	margin-top: 36rpx;
	display: flex;
	gap: 16rpx;
}

.btn {
	flex: 1;
	height: 84rpx;
	border-radius: 6rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 30rpx;
	font-weight: 700;
	letter-spacing: 2rpx;
	background: #111417;
	color: $paper;
}

.btn.ghost {
	background: rgba(17, 20, 23, 0.06);
	color: #3A4248;
	font-weight: 600;
}

.btn.danger {
	background: $coral;
	color: #FFF8F5;
}

.btn.calm {
	background: $seal;
	color: $paper;
}

.btn:active {
	opacity: 0.88;
	transform: scale(0.98);
}

.sheet-title {
	display: block;
	text-align: center;
	font-size: 32rpx;
	font-weight: 700;
	letter-spacing: 2rpx;
	color: #111417;
	margin-bottom: 8rpx;
	font-family: 'Songti SC', 'STSong', 'PingFang SC', serif;
}

.sheet-content {
	display: block;
	text-align: center;
	font-size: 26rpx;
	line-height: 1.6;
	color: $mute;
	margin-bottom: 18rpx;
	white-space: pre-wrap;
}

.action {
	min-height: 92rpx;
	margin-top: 12rpx;
	border-radius: 6rpx;
	background: rgba(255, 255, 255, 0.72);
	border: 1px solid rgba(70, 78, 88, 0.1);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 30rpx;
	font-weight: 600;
	color: #111417;
	letter-spacing: 1rpx;
}

.action.primary {
	background: #111417;
	color: $paper;
	border-color: #111417;
}

.action.danger {
	color: $coral;
	border-color: rgba(154, 91, 74, 0.28);
	background: rgba(154, 91, 74, 0.06);
}

.action.cancel {
	margin-top: 20rpx;
	background: transparent;
	border: none;
	color: $mute;
	font-weight: 500;
}

.action:active {
	opacity: 0.85;
}
</style>
