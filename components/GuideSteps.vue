<template>
	<view v-if="visible" class="guide-mask" :class="{ in: appear }" @touchmove.stop.prevent>
		<view class="guide-card" :class="{ in: appear }" @click.stop>
			<text class="guide-step">{{ stepIndex + 1 }} / {{ steps.length }}</text>
			<text class="guide-title">{{ current.title }}</text>
			<text class="guide-desc">{{ current.content }}</text>
			<view class="guide-dots">
				<view
					v-for="(s, i) in steps"
					:key="i"
					class="dot"
					:class="{ on: i === stepIndex }"
				/>
			</view>
			<view class="guide-btns">
				<view v-if="stepIndex > 0" class="btn ghost" @click="prev">
					<text>上一步</text>
				</view>
				<view class="btn calm" @click="next">
					<text>{{ isLast ? '开始使用' : '下一步' }}</text>
				</view>
			</view>
			<text v-if="!isLast" class="guide-skip" @click="finish">跳过</text>
		</view>
	</view>
</template>

<script>
const DEFAULT_STEPS = [
	{
		title: '每日打卡',
		content: '点下方圆形按钮：记为今天未抽烟。若抽了，再点可记录支数；也可改回「未抽」。'
	},
	{
		title: '月历手势',
		content: '左右滑动切换月份。轻点日期查看状态，长按日期可修改历史记录。'
	},
	{
		title: '提醒与备份',
		content: '右上角进入设置：可开每日提醒、导出/加密导出，以及按天自动本地备份。'
	}
]

export default {
	name: 'GuideSteps',
	emits: ['done'],
	props: {
		steps: {
			type: Array,
			default: () => DEFAULT_STEPS
		}
	},
	data() {
		return {
			visible: true,
			appear: false,
			stepIndex: 0
		}
	},
	computed: {
		current() {
			return this.steps[this.stepIndex] || { title: '', content: '' }
		},
		isLast() {
			return this.stepIndex >= this.steps.length - 1
		}
	},
	mounted() {
		this.$nextTick(() => {
			setTimeout(() => { this.appear = true }, 16)
		})
	},
	methods: {
		prev() {
			if (this.stepIndex > 0) this.stepIndex -= 1
		},
		next() {
			if (this.isLast) {
				this.finish()
				return
			}
			this.stepIndex += 1
		},
		finish() {
			this.appear = false
			setTimeout(() => {
				this.visible = false
				this.$emit('done')
			}, 180)
		}
	}
}
</script>

<style lang="scss" scoped>
@import '../common/theme.scss';

.guide-mask {
	position: fixed;
	inset: 0;
	z-index: 3000;
	background: rgba(28, 32, 36, 0.42);
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 48rpx;
	opacity: 0;
	transition: opacity 0.2s ease;
}

.guide-mask.in {
	opacity: 1;
}

.guide-card {
	width: 100%;
	max-width: 620rpx;
	padding: 44rpx 36rpx 28rpx;
	border-radius: 10rpx;
	background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(242, 241, 238, 0.98));
	border: 1px solid rgba(70, 78, 88, 0.12);
	box-shadow: 0 24rpx 60rpx rgba(20, 24, 27, 0.16);
	opacity: 0;
	transform: translateY(16rpx) scale(0.98);
	transition: opacity 0.22s ease, transform 0.22s ease;
}

.guide-card.in {
	opacity: 1;
	transform: translateY(0) scale(1);
}

.guide-step {
	display: block;
	text-align: center;
	font-size: 22rpx;
	letter-spacing: 2rpx;
	color: $mute;
	margin-bottom: 12rpx;
}

.guide-title {
	display: block;
	text-align: center;
	font-size: 36rpx;
	font-weight: 700;
	letter-spacing: 2rpx;
	color: #111417;
	font-family: 'Songti SC', 'STSong', 'PingFang SC', serif;
}

.guide-desc {
	display: block;
	margin-top: 20rpx;
	text-align: center;
	font-size: 28rpx;
	line-height: 1.65;
	color: #6B737B;
	white-space: pre-wrap;
}

.guide-dots {
	margin-top: 28rpx;
	display: flex;
	justify-content: center;
	gap: 10rpx;
}

.dot {
	width: 12rpx;
	height: 12rpx;
	border-radius: 50%;
	background: rgba(70, 78, 88, 0.18);
}

.dot.on {
	background: $seal;
}

.guide-btns {
	margin-top: 32rpx;
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
}

.btn.calm {
	background: $seal;
	color: $paper;
}

.btn.ghost {
	background: rgba(17, 20, 23, 0.06);
	color: #3A4248;
	font-weight: 600;
}

.guide-skip {
	display: block;
	margin-top: 18rpx;
	text-align: center;
	font-size: 24rpx;
	color: $mute;
	padding: 8rpx;
}
</style>
