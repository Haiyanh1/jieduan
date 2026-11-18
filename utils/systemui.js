/**
 * 系统栏与纸色背景对齐（尤其小米手势提示线）
 *
 * 小米官方两种适配：
 * 1) 沉浸式虚拟键：内容延伸到手势区，导航栏透明（适合纸纹背景）
 * 2) setNavigationBarColor：直接把虚拟键刷成页面底色
 *
 * 这里以沉浸式为主；失败则回退为直接上色。
 */
const PAPER = '#F2F1EE'

function isApp() {
	// #ifdef APP-PLUS
	return true
	// #endif
	return false
}

function paintSolidBars() {
	const Color = plus.android.importClass('android.graphics.Color')
	const WindowManager = plus.android.importClass('android.view.WindowManager')
	plus.android.importClass('android.view.Window')
	const activity = plus.android.runtimeMainActivity()
	const win = activity.getWindow()
	const paperInt = Color.parseColor(PAPER)
	win.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
	win.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS)
	win.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION)
	win.setStatusBarColor(paperInt)
	win.setNavigationBarColor(paperInt)
}

export function paintSystemBars() {
	try {
		uni.setBackgroundColor({
			backgroundColor: PAPER,
			backgroundColorTop: PAPER,
			backgroundColorBottom: PAPER
		})
	} catch (e) {}

	if (!isApp()) return
	if (plus.os.name !== 'Android') return

	try {
		plus.navigator.setStatusBarStyle('dark')
		plus.navigator.setStatusBarBackground(PAPER)
	} catch (e) {}

	try {
		const wv = plus.webview.currentWebview && plus.webview.currentWebview()
		if (wv && typeof wv.setStyle === 'function') {
			wv.setStyle({ background: PAPER })
		}
	} catch (e) {}

	try {
		const Build = plus.android.importClass('android.os.Build')
		if (!Build || Build.VERSION.SDK_INT < 21) return

		const Color = plus.android.importClass('android.graphics.Color')
		const View = plus.android.importClass('android.view.View')
		const WindowManager = plus.android.importClass('android.view.WindowManager')
		plus.android.importClass('android.view.Window')

		const activity = plus.android.runtimeMainActivity()
		const win = activity.getWindow()
		const paperInt = Color.parseColor(PAPER)
		const transparent = Color.TRANSPARENT

		win.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
		win.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS)
		win.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION)

		// 小米推荐：沉浸式 + 透明虚拟键，让页面纹理铺满底部
		win.setStatusBarColor(transparent)
		win.setNavigationBarColor(transparent)

		const decor = win.getDecorView()
		let flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
			| View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
			| View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
		if (Build.VERSION.SDK_INT >= 23) flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
		if (Build.VERSION.SDK_INT >= 26) flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
		decor.setSystemUiVisibility(flags)
		decor.setBackgroundColor(paperInt)

		if (Build.VERSION.SDK_INT >= 28) {
			try {
				win.setNavigationBarDividerColor(paperInt)
			} catch (e) {}
		}
		if (Build.VERSION.SDK_INT >= 29) {
			try {
				win.setNavigationBarContrastEnforced(false)
			} catch (e) {}
			try {
				win.setStatusBarContrastEnforced(false)
			} catch (e) {}
		}

		// 部分机型沉浸后仍发白：再强制刷一次纸色
		setTimeout(() => {
			try {
				const c = Color.parseColor(PAPER)
				win.setNavigationBarColor(c)
			} catch (e) {}
		}, 40)
	} catch (e) {
		try {
			paintSolidBars()
		} catch (err) {
			console.warn('paintSystemBars', err)
		}
	}
}
