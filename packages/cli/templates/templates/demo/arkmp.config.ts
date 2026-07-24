import { defineConfig } from '@arkmp/cli';

export default defineConfig({
  appId: '{{appId}}', // 替换为真实小程序 appId（生成 project.config.json）
  appName: '{{projectName}}',

  compile: {
    unitRatio: 2, // vp → rpx 换算系数
    sourcemap: true, // js 产物 sourcemap
    minify: false, // 构建时压缩（当前版本暂未实现，开启会告警并忽略）
    classPrefix: '', // 样式类名前缀（多工程共存时防冲突）
  },

  window: {
    // 全局窗口配置 → app.json.window
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f5f5f5',
  },

  tabBar: {
    // → app.json.tabBar（pages 按页面 struct 名引用）
    pages: [
      { name: 'Index', text: '首页' },
      { name: 'Mine', text: '我的' },
    ],
  },

  devServer: {
    autoOpenDevtool: false, // dev 时自动唤起微信开发者工具
    // devtoolPath: '/Applications/wechatwebdevtools.app', // macOS 默认路径
  },
});
