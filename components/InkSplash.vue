<template>
	<view
		v-if="show"
		class="ink-splash"
		:class="{ out: leaving }"
		:style="{ pointerEvents: leaving ? 'none' : 'auto' }"
		@touchstart.stop.prevent
		@touchmove.stop.prevent
		@click.stop.prevent
	>
		<view class="ink-paper"></view>
		<view class="ink-veil"></view>
		<view class="ink-center" :class="{ in: textIn }">
			<text class="ink-title">戒断</text>
			<text class="ink-sub">ROLL BACK</text>
		</view>
	</view>
</template>

<script>
/**
 * 页面内自定义开屏（不是系统原生 splash）
 * 关闭后必须卸掉节点，否则会挡住「设置」点击。
 */
export default {
	name: 'InkSplash',
	emits: ['done'],
	data() {
		return {
			show: true,
			textIn: false,
			leaving: false,
			doneSent: false,
			timers: []
		}
	},
	mounted() {
		this.kickNativeSplash()
		this.timers.push(setTimeout(() => { this.textIn = true }, 120))
		this.timers.push(setTimeout(() => { this.leaving = true }, 1600))
		this.timers.push(setTimeout(() => { this.finish() }, 2300))
		this.timers.push(setTimeout(() => { this.finish() }, 3000))
	},
	beforeUnmount() {
		this.clearTimers()
	},
	methods: {
		kickNativeSplash() {
			// #ifdef APP-PLUS
			try { plus.navigator.closeSplashscreen() } catch (e) {}
			// #endif
		},
		clearTimers() {
			;(this.timers || []).forEach((id) => clearTimeout(id))
			this.timers = []
		},
		/**
		 * 外部强制结束（例如跳转设置前）
		 * @param {{ silent?: boolean }} [opts] silent 时不触发 done，避免连带弹引导
		 */
		forceFinish(opts = {}) {
			this.finish({ silent: !!(opts && opts.silent) })
		},
		finish({ silent = false } = {}) {
			if (this.doneSent) return
			this.doneSent = true
			this.clearTimers()
			this.leaving = true
			this.kickNativeSplash()
			if (!silent) this.$emit('done')
			this.show = false
		}
	}
}
</script>

<style lang="scss" scoped>
@import '../common/theme.scss';

.ink-splash {
	position: fixed;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	z-index: 9999;
	display: flex;
	align-items: center;
	justify-content: center;
	background: $paper;
	opacity: 1;
	transition: opacity 0.65s ease;
}

.ink-splash.out {
	opacity: 0;
	pointer-events: none !important;
}

.ink-paper {
	position: absolute;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	background-color: $paper;
	background-image:
		linear-gradient(rgba(70, 78, 88, 0.035) 1px, transparent 1px),
		linear-gradient(90deg, rgba(70, 78, 88, 0.035) 1px, transparent 1px);
	background-size: 28rpx 28rpx;
}

.ink-veil {
	position: absolute;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	background:
		radial-gradient(ellipse at 50% 42%, rgba(242, 241, 238, 0.12), rgba(242, 241, 238, 0.55) 70%);
}

.ink-center {
	position: relative;
	z-index: 2;
	display: flex;
	flex-direction: column;
	align-items: center;
	opacity: 0;
	transform: translateY(16rpx) scale(0.96);
	transition: opacity 1s ease, transform 1.1s cubic-bezier(0.22, 0.8, 0.28, 1);
}

.ink-center.in {
	opacity: 1;
	transform: translateY(0) scale(1);
}

.ink-title {
	font-size: 120rpx;
	line-height: 1;
	letter-spacing: 28rpx;
	padding-left: 28rpx;
	color: #1A1E22;
	font-weight: 700;
	font-family: 'STXingkai', 'STKaiti', 'KaiTi', '楷体', 'Songti SC', 'STSong', serif;
}

.ink-sub {
	margin-top: 28rpx;
	font-size: 22rpx;
	letter-spacing: 10rpx;
	color: rgba(74, 93, 106, 0.72);
	font-family: 'Songti SC', 'STSong', 'PingFang SC', serif;
}
</style>
