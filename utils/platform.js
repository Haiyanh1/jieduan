/**
 * 运行环境判断与 Android 主 Activity 入口
 */

export function isApp() {
	// #ifdef APP-PLUS
	return true
	// #endif
	return false
}

export function isH5() {
	// #ifdef H5
	return true
	// #endif
	return typeof window !== 'undefined' && typeof document !== 'undefined' && !isApp()
}

export function getMainActivity() {
	if (!isApp()) return null
	return plus.android.runtimeMainActivity()
}
