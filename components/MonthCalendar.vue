<template>
	<view
		class="paper-sheet"
		@touchstart="onCalTouchStart"
		@touchmove.stop.prevent="onCalTouchMove"
		@touchend="onCalTouchEnd"
		@touchcancel="onCalTouchEnd"
	>
		<view class="sheet-edge"></view>

		<view class="cal-stage">
			<view class="sheet-head">
				<view class="cal-track cal-year" :class="yearTrackClass" :style="yearTrackStyle">
					<text class="y">{{ year }}</text>
				</view>
				<view class="cal-track cal-month" :class="calTrackClass" :style="calTrackStyle">
					<text class="m">{{ month + 1 }}</text>
				</view>
			</view>

			<view class="week week-fixed">
				<text v-for="w in weeks" :key="w" class="w">{{ w }}</text>
			</view>

			<view class="cal-track cal-days" :class="calTrackClass" :style="calTrackStyle">
				<view class="days">
					<view
						v-for="(cell, idx) in cells"
						:key="`${year}-${month}-${idx}`"
						class="day"
						@click="onTapCell(cell)"
						@longpress="onLongPressCell(cell)"
					>
						<view class="day-inner" :class="dayClass(cell)">
							<text class="day-num">{{ cell.day }}</text>
						</view>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
import { monthMatrix, pad } from '../utils/date.js'
import { statusOf } from '../utils/checkin-stats.js'

export default {
	name: 'MonthCalendar',
	props: {
		year: { type: Number, required: true },
		month: { type: Number, required: true },
		today: { type: String, required: true },
		checkins: { type: Object, default: () => ({}) }
	},
	emits: ['update:year', 'update:month', 'day-tap', 'day-longpress'],
	data() {
		return {
			weeks: ['一', '二', '三', '四', '五', '六', '日'],
			touchStartX: 0,
			touchStartY: 0,
			touchDeltaX: 0,
			touchMoved: false,
			calBusy: false,
			calAnimating: false,
			calPhase: '',
			yearAnimating: false,
			yearPhase: '',
			yearWillChange: false,
			swipeGuardUntil: 0
		}
	},
	computed: {
		cells() {
			return monthMatrix(this.year, this.month)
		},
		calTrackClass() {
			return {
				animating: this.calAnimating,
				[this.calPhase]: !!this.calPhase
			}
		},
		calTrackStyle() {
			if (this.calBusy || this.calPhase) return {}
			if (!this.touchDeltaX) return {}
			return {
				transform: `translateX(${this.touchDeltaX}px)`,
				opacity: String(Math.max(0.55, 1 - Math.abs(this.touchDeltaX) / 360))
			}
		},
		yearTrackClass() {
			if (!this.yearWillChange && !this.yearPhase) return {}
			return {
				animating: this.yearAnimating,
				[this.yearPhase]: !!this.yearPhase
			}
		},
		yearTrackStyle() {
			if (!this.yearWillChange) return {}
			if (this.calBusy || this.yearPhase) return {}
			if (!this.touchDeltaX) return {}
			return {
				transform: `translateX(${this.touchDeltaX}px)`,
				opacity: String(Math.max(0.55, 1 - Math.abs(this.touchDeltaX) / 360))
			}
		}
	},
	methods: {
		dateKey(day) {
			return `${this.year}-${pad(this.month + 1)}-${pad(day)}`
		},
		dayClass(cell) {
			if (!cell.inMonth) return { outside: true }
			const key = this.dateKey(cell.day)
			const status = statusOf(this.checkins, key)
			return {
				checked: status === 'success',
				failed: status === 'fail',
				today: key === this.today,
				future: key > this.today
			}
		},
		shiftMonth(delta) {
			const d = new Date(this.year, this.month + delta, 1)
			this.$emit('update:year', d.getFullYear())
			this.$emit('update:month', d.getMonth())
		},
		willCrossYear(delta) {
			const d = new Date(this.year, this.month + delta, 1)
			return d.getFullYear() !== this.year
		},
		wait(ms) {
			return new Promise((resolve) => setTimeout(resolve, ms))
		},
		async animateMonth(delta) {
			if (this.calBusy) return
			const crossYear = this.willCrossYear(delta)
			this.yearWillChange = crossYear
			this.calBusy = true
			this.calAnimating = true
			this.yearAnimating = crossYear
			this.touchDeltaX = 0
			const outPhase = delta > 0 ? 'out-left' : 'out-right'
			const prepPhase = delta > 0 ? 'prep-right' : 'prep-left'
			this.calPhase = outPhase
			this.yearPhase = crossYear ? outPhase : ''
			await this.wait(240)
			this.shiftMonth(delta)
			this.calAnimating = false
			this.yearAnimating = false
			this.calPhase = prepPhase
			this.yearPhase = crossYear ? prepPhase : ''
			await this.wait(20)
			this.calAnimating = true
			this.yearAnimating = crossYear
			this.calPhase = 'in'
			this.yearPhase = crossYear ? 'in' : ''
			await this.wait(260)
			this.calPhase = ''
			this.yearPhase = ''
			this.calAnimating = false
			this.yearAnimating = false
			this.yearWillChange = false
			this.calBusy = false
		},
		onCalTouchStart(e) {
			if (this.calBusy) return
			const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
			if (!t) return
			this.touchStartX = t.clientX
			this.touchStartY = t.clientY
			this.touchDeltaX = 0
			this.touchMoved = false
			this.yearWillChange = false
		},
		onCalTouchMove(e) {
			if (this.calBusy) return
			const t = e.touches && e.touches[0]
			if (!t) return
			const dx = t.clientX - this.touchStartX
			const dy = t.clientY - this.touchStartY
			if (!this.touchMoved) {
				if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
				if (Math.abs(dy) > Math.abs(dx)) return
				this.touchMoved = true
			}
			const delta = dx < 0 ? 1 : -1
			this.yearWillChange = Math.abs(dx) >= 24 && this.willCrossYear(delta)
			this.touchDeltaX = dx * 0.72
		},
		onCalTouchEnd(e) {
			if (this.calBusy) {
				this.touchDeltaX = 0
				this.touchMoved = false
				this.yearWillChange = false
				return
			}
			const t = e.changedTouches && e.changedTouches[0]
			if (!t) {
				this.touchDeltaX = 0
				this.yearWillChange = false
				return
			}
			const dx = t.clientX - this.touchStartX
			const dy = t.clientY - this.touchStartY
			const moved = this.touchMoved || Math.abs(dx) >= 48
			this.touchDeltaX = 0
			this.touchMoved = false
			if (!moved || Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.15) {
				this.yearWillChange = false
				return
			}
			this.swipeGuardUntil = Date.now() + 320
			if (dx < 0) this.animateMonth(1)
			else this.animateMonth(-1)
		},
		blocked() {
			return this.calBusy || this.touchMoved || Date.now() < this.swipeGuardUntil
		},
		onTapCell(cell) {
			if (this.blocked()) return
			if (!cell.inMonth) {
				this.animateMonth(cell.offset < 0 ? -1 : 1)
				return
			}
			this.$emit('day-tap', { key: this.dateKey(cell.day), day: cell.day })
		},
		onLongPressCell(cell) {
			if (this.blocked()) return
			if (!cell.inMonth) return
			this.$emit('day-longpress', { key: this.dateKey(cell.day), day: cell.day })
		}
	}
}
</script>

<style lang="scss" scoped>
@import '../common/theme.scss';

.paper-sheet {
	margin-top: 28rpx;
	padding: 28rpx 20rpx 24rpx;
	border-radius: 4rpx;
	background: linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(236, 237, 239, 0.82));
	border: 1px solid rgba(70, 78, 88, 0.12);
	box-shadow:
		0 1px 0 rgba(255, 255, 255, 0.65) inset,
		0 16px 36px rgba(44, 49, 54, 0.05);
	position: relative;
}

.sheet-edge {
	position: absolute;
	left: 0;
	top: 0;
	bottom: 0;
	width: 14rpx;
	background:
		repeating-linear-gradient(
			180deg,
			rgba(70, 78, 88, 0.08) 0 4rpx,
			transparent 4rpx 12rpx
		);
	opacity: 0.65;
}

.sheet-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 16rpx 28rpx;
	overflow: hidden;
}

.cal-year,
.cal-month {
	display: flex;
	align-items: center;
}

.cal-year { justify-content: flex-start; }
.cal-month { justify-content: flex-end; }

.y, .m {
	font-size: 40rpx;
	letter-spacing: 3rpx;
	color: $ink;
	font-weight: 700;
	font-family: 'Songti SC', 'STSong', 'PingFang SC', serif;
	line-height: 1;
}

.cal-stage {
	overflow: hidden;
	width: 100%;
}

.cal-track {
	width: 100%;
	will-change: transform, opacity;
}

.cal-track.animating {
	transition: transform 0.26s cubic-bezier(0.22, 0.8, 0.28, 1), opacity 0.26s ease;
}

.cal-track.out-left { transform: translateX(-42%); opacity: 0; }
.cal-track.out-right { transform: translateX(42%); opacity: 0; }
.cal-track.prep-left { transform: translateX(-42%); opacity: 0; transition: none; }
.cal-track.prep-right { transform: translateX(42%); opacity: 0; transition: none; }
.cal-track.in { transform: translateX(0); opacity: 1; }

.week-fixed,
.days {
	display: flex;
	flex-wrap: wrap;
}

.week-fixed { position: relative; z-index: 2; }

.days {
	height: 576rpx;
	align-content: flex-start;
}

.w, .day {
	width: 14.28%;
	display: flex;
	justify-content: center;
	align-items: center;
}

.w {
	font-size: 22rpx;
	color: $mute;
	padding-bottom: 18rpx;
	letter-spacing: 2rpx;
}

.day { height: 96rpx; }

.day-inner {
	width: 72rpx;
	height: 72rpx;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
}

.day-num {
	font-size: 28rpx;
	color: #111417;
	font-weight: 700;
}

.day-inner.outside .day-num {
	color: #B0B6BD;
	font-weight: 500;
}

.day-inner.future .day-num {
	color: #8A939A;
	font-weight: 600;
}

.day-inner.today {
	border: 1px dashed rgba(74, 93, 106, 0.55);
}

.day-inner.checked {
	background: $ink;
}

.day-inner.checked .day-num {
	color: $paper;
}

.day-inner.checked.today {
	background: $seal;
	border: none;
}

.day-inner.failed {
	background: rgba(154, 91, 74, 0.16);
	border: 1px solid rgba(154, 91, 74, 0.45);
}

.day-inner.failed .day-num {
	color: $coral;
}

.day-inner.failed.today {
	background: $coral;
	border: none;
}

.day-inner.failed.today .day-num {
	color: $paper;
}
</style>
