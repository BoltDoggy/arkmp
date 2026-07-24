/**
 * wx.* 映射表（06 篇"路由适配"与"系统 API 映射"的机器可读形式，纯数据）。
 *
 * 每条条目描述：源码侧 API（@arkmp/api 命名空间）→ 产物 wx.* 调用，
 * 参数适配方式与 runtime 桥接依赖。不支持的鸿蒙能力带降级诊断说明（E3xxx）。
 */

/** 参数适配方式：direct 直传 / wrap 包装改写 / unsupported 不支持 */
export type ParamAdapter = 'direct' | 'wrap' | 'unsupported';

/** API 类别：router 路由适配 / system 系统 API */
export type ApiCategory = 'router' | 'system';

/** 单条 API 映射 */
export interface ApiMapping {
  /** 源码侧 API 路径，如 'http.request'、'router.push' */
  readonly source: string;
  /** 源码侧签名描述（06 篇表格左列） */
  readonly signature: string;
  /** 产物目标：wx.* API 名；编译为页面配置时填配置名；不支持时为 null */
  readonly target: string | null;
  /** 参数适配方式 */
  readonly adapter: ParamAdapter;
  /** 产物是否依赖 @arkmp/runtime 桥接（Promise 化包装、回传编解码等） */
  readonly runtimeBridge: boolean;
  /** 适配说明（参数改写、序列化约定等） */
  readonly note: string;
  /** adapter 为 'unsupported' 时的降级诊断与替代建议（编译期 E3xxx 文案来源） */
  readonly fallback?: string;
  /** 类别 */
  readonly category: ApiCategory;
}

/**
 * 路由适配映射（06 篇"路由适配"表，5 条）。
 * 路由表由编译期 @Entry 收集生成，param 由编译器统一编解码。
 */
export const routerMappings: readonly ApiMapping[] = [
  {
    source: 'router.push',
    signature: 'router.push({ name, param?, onResult? })',
    target: 'wx.navigateTo',
    adapter: 'wrap',
    runtimeBridge: true,
    note: 'name 经路由表映射为页面路径；param 简单值拼 query、对象值 encodeURIComponent(JSON.stringify())；onResult 编译为 events 参数 + eventChannel 回传',
    category: 'router',
  },
  {
    source: 'router.replace',
    signature: 'router.replace({ name, param? })',
    target: 'wx.redirectTo',
    adapter: 'wrap',
    runtimeBridge: false,
    note: 'name 经路由表映射为页面路径，param 同 router.push 编解码',
    category: 'router',
  },
  {
    source: 'router.back',
    signature: 'router.back()',
    target: 'wx.navigateBack',
    adapter: 'direct',
    runtimeBridge: false,
    note: '无参直调',
    category: 'router',
  },
  {
    source: 'router.pop',
    signature: 'router.pop(result?)',
    target: 'eventChannel.emit',
    adapter: 'wrap',
    runtimeBridge: true,
    note: '子页面回传数据：runtime 封装为 eventChannel.emit 后 wx.navigateBack',
    category: 'router',
  },
  {
    source: 'router.switchTab',
    signature: 'router.switchTab({ name })',
    target: 'wx.switchTab',
    adapter: 'wrap',
    runtimeBridge: false,
    note: 'tab 页显式区分；编译期校验 tab 页面集合与 app.json tabBar 一致（不一致报 E5xxx）',
    category: 'router',
  },
  {
    source: 'router.relaunch',
    signature: 'router.relaunch({ name, param? })',
    target: 'wx.reLaunch',
    adapter: 'wrap',
    runtimeBridge: false,
    note: 'name 经路由表映射为页面路径',
    category: 'router',
  },
];

/**
 * 系统 API 映射（06 篇"系统 API 映射"表，14 条源码侧 API）。
 * 统一约定：全部 Promise 化；fail 回调统一转 reject（code/message 对齐 BusinessError）。
 */
export const systemMappings: readonly ApiMapping[] = [
  {
    source: 'http.request',
    signature: 'http.request(url, options?): Promise<HttpResponse>',
    target: 'wx.request',
    adapter: 'wrap',
    runtimeBridge: true,
    note: 'wx 回调风格由 runtime Promise 化；域名需在 mp 后台配置白名单（ark-mp check 扫描生成清单）',
    category: 'system',
  },
  {
    source: 'storage.set',
    signature: 'storage.set(key, value)',
    target: 'wx.setStorageSync',
    adapter: 'wrap',
    runtimeBridge: true,
    note: '值自动 JSON 序列化',
    category: 'system',
  },
  {
    source: 'storage.get',
    signature: 'storage.get(key): Promise<T>',
    target: 'wx.getStorageSync',
    adapter: 'wrap',
    runtimeBridge: true,
    note: '值自动 JSON 反序列化',
    category: 'system',
  },
  {
    source: 'storage.remove',
    signature: 'storage.remove(key)',
    target: 'wx.removeStorageSync',
    adapter: 'direct',
    runtimeBridge: false,
    note: 'key 直传',
    category: 'system',
  },
  {
    source: 'prompt.showToast',
    signature: 'prompt.showToast({ message, duration? })',
    target: 'wx.showToast',
    adapter: 'wrap',
    runtimeBridge: true,
    note: 'message → title',
    category: 'system',
  },
  {
    source: 'prompt.showDialog',
    signature: 'prompt.showDialog({ title, message, buttons }): Promise<number>',
    target: 'wx.showModal',
    adapter: 'wrap',
    runtimeBridge: true,
    note: 'buttons 两键映射 confirm/cancel，resolve 点击下标',
    category: 'system',
  },
  {
    source: 'prompt.showActionMenu',
    signature: 'prompt.showActionMenu({ items }): Promise<number>',
    target: 'wx.showActionSheet',
    adapter: 'wrap',
    runtimeBridge: true,
    note: 'items → itemList，resolve tapIndex',
    category: 'system',
  },
  {
    source: 'media.pickImage',
    signature: 'media.pickImage({ count }): Promise<string[]>',
    target: 'wx.chooseMedia',
    adapter: 'wrap',
    runtimeBridge: true,
    note: '固定 mediaType: image，resolve 临时文件路径数组',
    category: 'system',
  },
  {
    source: 'media.previewImage',
    signature: 'media.previewImage(urls, current?)',
    target: 'wx.previewImage',
    adapter: 'wrap',
    runtimeBridge: true,
    note: 'urls/current 参数名对齐',
    category: 'system',
  },
  {
    source: 'location.getCurrent',
    signature: 'location.getCurrent(): Promise<Location>',
    target: 'wx.getLocation',
    adapter: 'wrap',
    runtimeBridge: true,
    note: '编译器自动在 app.json 生成 permission 字段（描述文案取自编译配置）',
    category: 'system',
  },
  {
    source: 'share.share',
    signature: 'share.share({ title, path })',
    target: 'onShareAppMessage',
    adapter: 'wrap',
    runtimeBridge: false,
    note: '编译为页面 onShareAppMessage 配置 + ShareButton 适配组件（<button open-type="share">）提示',
    category: 'system',
  },
  {
    source: 'auth.login',
    signature: 'auth.login(): Promise<{ code }>',
    target: 'wx.login',
    adapter: 'direct',
    runtimeBridge: true,
    note: 'runtime Promise 化包装',
    category: 'system',
  },
  {
    source: 'device.getNetworkType',
    signature: 'device.getNetworkType(): Promise<NetworkType>',
    target: 'wx.getNetworkType',
    adapter: 'direct',
    runtimeBridge: true,
    note: 'runtime Promise 化包装',
    category: 'system',
  },
  {
    source: 'pay.request',
    signature: 'pay.request(params): Promise<void>',
    target: 'wx.requestPayment',
    adapter: 'wrap',
    runtimeBridge: true,
    note: '参数名对齐 wx.requestPayment（timeStamp/nonceStr/package/signType/paySign）',
    category: 'system',
  },
];

/**
 * 平台能力缺失（06 篇"平台能力缺失的处理"）：源码调用小程序不存在的能力时
 * 编译期报 E3xxx，fallback 字段即诊断文案与替代建议来源。
 */
export const unsupportedMappings: readonly ApiMapping[] = [
  {
    source: 'form.createCard',
    signature: 'form.createCard(options)',
    target: null,
    adapter: 'unsupported',
    runtimeBridge: false,
    note: '鸿蒙服务卡片能力',
    fallback: 'E3001：小程序无服务卡片能力，建议改用分享卡片页（share.share）或订阅消息触达',
    category: 'system',
  },
  {
    source: 'distributed.continue',
    signature: 'distributed.continue(options)',
    target: null,
    adapter: 'unsupported',
    runtimeBridge: false,
    note: '鸿蒙跨设备流转能力',
    fallback: 'E3002：小程序无跨设备流转能力，建议改为生成口令/二维码由对端扫码接续',
    category: 'system',
  },
];

/** 全量映射表（路由 + 系统 + 不支持能力） */
export const apiMappings: readonly ApiMapping[] = [
  ...routerMappings,
  ...systemMappings,
  ...unsupportedMappings,
];
