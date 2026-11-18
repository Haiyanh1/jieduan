/**
 * PaperDialog 状态与打开/关闭（首页与设置面板共用）
 */
export default {
	data() {
		return {
			dialog: {
				visible: false,
				title: '',
				content: '',
				cancelText: '取消',
				confirmText: '确定',
				tone: 'ink',
				actions: [],
				onConfirm: null,
				onAction: null
			}
		}
	},
	methods: {
		openConfirm({
			title,
			content,
			confirmText = '确定',
			cancelText = '取消',
			tone = 'ink',
			onConfirm
		}) {
			this.dialog = {
				visible: true,
				title,
				content,
				confirmText,
				cancelText,
				tone,
				actions: [],
				onConfirm: onConfirm || null,
				onAction: null
			}
		},
		openSheet({ title = '', content = '', cancelText = '关闭', actions = [], onAction }) {
			this.dialog = {
				visible: true,
				title,
				content,
				confirmText: '',
				cancelText,
				tone: 'ink',
				actions,
				onConfirm: null,
				onAction: onAction || null
			}
		},
		closeDialog() {
			this.dialog = {
				...this.dialog,
				visible: false,
				onConfirm: null,
				onAction: null
			}
		},
		forceCloseDialog() {
			this.dialog.visible = false
			this.dialog.onConfirm = null
			this.dialog.onAction = null
		},
		onDialogConfirm() {
			const fn = this.dialog.onConfirm
			this.closeDialog()
			setTimeout(() => {
				if (typeof fn === 'function') fn()
			}, 220)
		},
		onDialogAction(payload) {
			const fn = this.dialog.onAction
			this.closeDialog()
			setTimeout(() => {
				if (typeof fn === 'function') fn(payload)
			}, 220)
		}
	}
}
