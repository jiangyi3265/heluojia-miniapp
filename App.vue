<script>
	export default {
		onLaunch: function() {
			// #ifdef MP-WEIXIN
			// 发布新版后让用户尽快用上：新包下载好就提示重启，避免旧版（旧接口、旧费用说明）继续运行。
			const updater = uni.getUpdateManager && uni.getUpdateManager()
			if (updater) updater.onUpdateReady(() => {
				uni.showModal({title: '发现新版本', content: '新版本已经准备好，重启小程序后即可使用。', showCancel: false, confirmText: '立即重启', success: () => updater.applyUpdate()})
			})
			// #endif
		},
		onShow: function() {
			console.log('App Show')
		},
		onHide: function() {
			console.log('App Hide')
		}
	}
</script>

<style>
	@import './styles/theme.css';
	/* #ifdef H5 */
	/* uni-app 的网页版会在打开 3 秒后从 cdn.dcloud.net.cn 预读一张导航栏阴影图；本商城的页面都不用这张图，关掉，网页版不再请求外部网站 */
	html body::after{animation:none}
	/* #endif */
</style>
