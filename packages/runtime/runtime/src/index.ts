/**
 * @arkmp/runtime —— ArkMP 产物侧运行时（L5）。
 *
 * 职责仅限四块（见 docs/arkui-miniprogram/06）：
 * - createPage / createComponent：构造器封装，state → data 桥接 + 生命周期分发；
 * - state：访问器 + Proxy 兜底、批量 setData 调度、派生字段重算、@Watch 触发；
 * - utils：事件参数规范化等；
 * - BASE_WXSS：内置基础类定义，供编译器写入产物 wxss。
 *
 * 约定：所有运行时报错/告警均带 `[arkmp]` 前缀。
 */

const PREFIX = '[arkmp]';

type Fn = (this: any, ...args: any[]) => any;

export type StateDef = Record<string, unknown>;

/** @Watch 回调：方法名（字符串）或直接给函数。回调签名 (value, key)。 */
export type WatchHandler = string | Fn;
export type WatchDef = Record<string, WatchHandler>;

/** 派生字段定义：[...依赖字段, 计算函数]，计算函数接收完整 data。 */
export type DerivedFn = (this: any, data: Record<string, any>) => unknown;
export type DerivedSpec = (string | DerivedFn)[];
export type DerivedDef = Record<string, DerivedSpec>;

type MethodsDef = Record<string, Fn>;

export interface PageOptions {
  state?: StateDef;
  /** 非响应式初始值（普通成员变量），透传给小程序 data，不安装访问器。 */
  data?: StateDef;
  derived?: DerivedDef;
  watch?: WatchDef;
  methods?: MethodsDef;
  /** 其余原生 Page 配置（如 onShareAppMessage）原样透传。 */
  [key: string]: unknown;
}

export interface ComponentOptions {
  state?: StateDef;
  /** 非响应式初始值（普通成员变量），透传给小程序 data，不安装访问器。 */
  data?: StateDef;
  properties?: Record<string, unknown>;
  derived?: DerivedDef;
  watch?: WatchDef;
  methods?: MethodsDef;
  /** 其余原生 Component 配置（options/externalClasses/relations 等）原样透传。 */
  [key: string]: unknown;
}

export interface NormalizedEvent {
  type: string;
  detail: Record<string, any>;
  id: string;
  dataset: Record<string, any>;
  x: number;
  y: number;
  timeStamp: number;
}

/** 编译器写入产物 wxss 的内置基础类。 */
export const BASE_WXSS =
  '.arkmp-page{width:100%;min-height:100vh;box-sizing:border-box;}\n' +
  '.arkmp-col{display:flex;flex-direction:column;box-sizing:border-box;}\n' +
  '.arkmp-row{display:flex;flex-direction:row;box-sizing:border-box;}\n' +
  '.arkmp-text{display:inline;}\n' +
  '.arkmp-btn{display:flex;align-items:center;justify-content:center;box-sizing:border-box;}\n' +
  '.arkmp-input{box-sizing:border-box;height:80rpx;line-height:80rpx;}\n' +
  '.arkmp-textarea{box-sizing:border-box;}\n';

/**
 * ArkUI 页面生命周期 → 小程序 Page 钩子（05 篇映射表）。
 * ArkUI 命名映射到原生钩子；原生命名以恒等映射列入，
 * 使两套命名在 createPage 遍历时走同一分发路径。
 */
const PAGE_LIFECYCLES: Record<string, string> = {
  // ArkUI 命名 → 小程序原生钩子
  aboutToAppear: 'onLoad',
  onPageShow: 'onShow',
  onDidBuild: 'onReady',
  onPageHide: 'onHide',
  aboutToDisappear: 'onUnload',
  onPullRefresh: 'onPullDownRefresh',
  // 小程序原生页面钩子（恒等映射，同时支持原生命名）
  onLoad: 'onLoad',
  onShow: 'onShow',
  onReady: 'onReady',
  onHide: 'onHide',
  onUnload: 'onUnload',
  onPullDownRefresh: 'onPullDownRefresh',
};

/**
 * ArkUI 组件生命周期 → 小程序 lifetimes（05 篇映射表）。
 * 原生命名以恒等映射列入，使组件原生命名钩子能正确路由到 lifetimes 块
 * （而非被当作普通 method）。
 */
const COMPONENT_LIFETIMES: Record<string, string> = {
  // ArkUI 命名 → 小程序组件 lifetimes
  aboutToAppear: 'attached',
  onDidBuild: 'ready',
  aboutToDisappear: 'detached',
  // 小程序原生组件 lifetimes（恒等映射）
  created: 'created',
  attached: 'attached',
  ready: 'ready',
  moved: 'moved',
  detached: 'detached',
};

function fail(message: string): never {
  throw new Error(`${PREFIX} ${message}`);
}

function warn(message: string): void {
  // eslint-disable-next-line no-console
  console.warn(`${PREFIX} ${message}`);
}

function rootOf(key: string): string {
  const dot = key.indexOf('.');
  const bracket = key.indexOf('[');
  let end = key.length;
  if (dot !== -1 && dot < end) end = dot;
  if (bracket !== -1 && bracket < end) end = bracket;
  return key.slice(0, end);
}

/** 支持 'a.b' / 'a[0].b' 路径的深写入（与 setData 路径语法一致）。 */
function setDeep(data: Record<string, any>, path: string, value: unknown): void {
  const segs = path.replace(/\[(\w+)\]/g, '.$1').split('.');
  let node: any = data;
  for (let i = 0; i < segs.length - 1; i++) {
    node = node?.[segs[i]];
    if (node === null || typeof node !== 'object') return;
  }
  node[segs[segs.length - 1]] = value;
}

function fireWatch(ctx: any, watch: WatchDef, key: string, value: unknown): void {
  const root = rootOf(key);
  const handler = watch[root];
  if (handler === undefined) return;
  if (typeof handler === 'string') {
    const fn = ctx[handler];
    if (typeof fn !== 'function') {
      warn(`@Watch 回调 "${handler}" 不存在（字段 ${root}）`);
      return;
    }
    fn.call(ctx, value, root);
  } else if (typeof handler === 'function') {
    handler.call(ctx, value, root);
  } else {
    warn(`@Watch 配置无效（字段 ${root}）`);
  }
}

function validateDerived(derived: DerivedDef): void {
  for (const name in derived) {
    const spec = derived[name];
    if (!Array.isArray(spec) || spec.length < 2 || typeof spec[spec.length - 1] !== 'function') {
      fail(`derived 字段 "${name}" 配置无效：应为 [...依赖字段, 计算函数]`);
    }
  }
}

/**
 * 在页面/组件实例上安装状态桥接：
 * 1. 每个 state 字段定义访问器，`this.count = 1` 式写入桥接到批量 setData；
 * 2. 嵌套对象/数组经 Proxy 包装，深层写入兜底为根字段整体 setData；
 * 3. 同一 tick 内多次写入合并为一次 setData，随后按依赖表重算 derived；
 * 4. @Watch 回调在写入时同步触发（05 篇：Proxy 路径同步调用）。
 *
 * 同时安装 `__set(key, value)`：编译期改写桥接入口，key 支持 'a.b' / 'a[0]' 路径。
 */
function attachState(ctx: any, state: StateDef, watch: WatchDef, derived: DerivedDef): void {
  if (ctx.data === null || typeof ctx.data !== 'object') ctx.data = { ...state };
  if (typeof ctx.setData !== 'function') fail('实例缺少 setData：attachState 必须在小程序页面/组件上下文中执行');

  const pending: Record<string, unknown> = Object.create(null);
  const dirty = new Set<string>();
  let scheduled = false;

  const schedule = (key: string, value: unknown): void => {
    pending[key] = value;
    dirty.add(rootOf(key));
    if (scheduled) return;
    scheduled = true;
    void Promise.resolve().then(() => {
      scheduled = false;
      const patch: Record<string, unknown> = Object.create(null);
      for (const k in pending) {
        patch[k] = pending[k];
        delete pending[k];
      }
      ctx.setData(patch);
      // 派生字段重算：依赖命中才重算，值变化才下发
      for (const name in derived) {
        const spec = derived[name];
        const fn = spec[spec.length - 1] as DerivedFn;
        const deps = spec.slice(0, -1) as string[];
        if (!deps.some((dep) => dirty.has(dep))) continue;
        const value = fn.call(ctx, ctx.data);
        if (ctx.data[name] !== value) ctx.setData({ [name]: value });
      }
      dirty.clear();
    });
  };

  const wrapDeep = (value: unknown, rootKey: string): unknown => {
    if (value === null || typeof value !== 'object') return value;
    return new Proxy(value as object, {
      get(target, prop, receiver) {
        return wrapDeep(Reflect.get(target, prop, receiver), rootKey);
      },
      set(target, prop, v, receiver) {
        Reflect.set(target, prop, v, receiver);
        schedule(rootKey, ctx.data[rootKey]);
        fireWatch(ctx, watch, rootKey, ctx.data[rootKey]);
        return true;
      },
      deleteProperty(target, prop) {
        Reflect.deleteProperty(target, prop);
        schedule(rootKey, ctx.data[rootKey]);
        fireWatch(ctx, watch, rootKey, ctx.data[rootKey]);
        return true;
      },
    });
  };

  for (const key of Object.keys(state)) {
    Object.defineProperty(ctx, key, {
      configurable: true,
      enumerable: true,
      get() {
        return wrapDeep(ctx.data[key], key);
      },
      set(v: unknown) {
        ctx.data[key] = v;
        schedule(key, v);
        fireWatch(ctx, watch, key, v);
      },
    });
  }

  ctx.__set = (key: string, value: unknown): void => {
    setDeep(ctx.data, key, value);
    schedule(key, value);
    fireWatch(ctx, watch, key, value);
  };
}

function resolveGlobals(name: 'Page' | 'Component'): Fn {
  const fn = (globalThis as Record<string, unknown>)[name];
  if (typeof fn !== 'function') {
    fail(`${name === 'Page' ? 'createPage' : 'createComponent'}: 全局 ${name}() 不存在，产物需在微信小程序环境中运行`);
  }
  return fn as Fn;
}

/** 页面构造器封装：state 桥接 + 生命周期分发（见 06 篇）。 */
export function createPage(options: PageOptions): void {
  const Page = resolveGlobals('Page');
  if (options === null || typeof options !== 'object') fail('createPage: options 必须为对象');
  const { state = {}, data: staticData = {}, derived = {}, watch = {}, methods = {}, ...rest } = options;
  validateDerived(derived);

  const config: Record<string, unknown> = { ...rest, data: { ...staticData, ...state } };

  for (const name in methods) {
    const fn = methods[name];
    const target = PAGE_LIFECYCLES[name];
    if (target === undefined) {
      config[name] = fn;
    } else if (name === 'onPullRefresh' || name === 'onPullDownRefresh') {
      config[target] = function (this: any, ...args: unknown[]) {
        const r = fn.apply(this, args);
        const wx = (globalThis as Record<string, any>).wx;
        if (wx && typeof wx.stopPullDownRefresh === 'function') wx.stopPullDownRefresh();
        return r;
      };
    } else {
      config[target] = fn;
    }
  }

  // 始终接管 onLoad：安装状态桥接后再调用用户 aboutToAppear
  const userOnLoad = config.onLoad as Fn | undefined;
  config.onLoad = function (this: any, query: unknown) {
    attachState(this, state, watch, derived);
    if (userOnLoad !== undefined) return userOnLoad.call(this, query);
  };

  Page(config);
}

/** 组件构造器封装：properties / observers 桥接 + lifetimes 分发（见 05/06 篇）。 */
export function createComponent(options: ComponentOptions): void {
  const Component = resolveGlobals('Component');
  if (options === null || typeof options !== 'object') fail('createComponent: options 必须为对象');
  const { state = {}, data: staticData = {}, properties = {}, derived = {}, watch = {}, methods = {}, ...rest } = options;
  validateDerived(derived);

  // observers 桥接：@Watch 标注的 property 变化时触发回调（保留用户自定义 observers）
  const userObservers = (rest.observers ?? {}) as Record<string, Fn>;
  delete rest.observers;
  const observers: Record<string, Fn> = { ...userObservers };
  for (const key in watch) {
    if (!(key in (properties as Record<string, unknown>))) continue;
    const user = observers[key];
    observers[key] = function (this: any, newVal: unknown) {
      if (user !== undefined) user.call(this, newVal);
      fireWatch(this, watch, key, newVal);
    };
  }

  // lifetimes 桥接：生命周期方法从 methods 中映射（保留用户自定义 lifetimes）
  const lifetimes: Record<string, Fn> = { ...((rest.lifetimes ?? {}) as Record<string, Fn>) };
  delete rest.lifetimes;
  const compMethods: MethodsDef = {};
  for (const name in methods) {
    const target = COMPONENT_LIFETIMES[name];
    if (target === undefined) compMethods[name] = methods[name];
    else lifetimes[target] = methods[name];
  }

  // 始终接管 attached：安装状态桥接后再调用用户 aboutToAppear
  const userAttached = lifetimes.attached;
  lifetimes.attached = function (this: any) {
    attachState(this, state, watch, derived);
    if (userAttached !== undefined) return userAttached.call(this);
  };

  Component({
    ...rest,
    properties,
    data: { ...staticData, ...state },
    methods: compMethods,
    observers,
    lifetimes,
  });
}

/** 事件参数规范化：抹平 tap/touch/表单事件差异（见 06 篇 utils）。 */
export function normalizeEvent(e: Record<string, any>): NormalizedEvent {
  if (e === null || typeof e !== 'object') fail('normalizeEvent: 事件对象无效');
  const touch =
    (Array.isArray(e.touches) && e.touches[0]) ||
    (Array.isArray(e.changedTouches) && e.changedTouches[0]) ||
    {};
  const target = (e.currentTarget ?? e.target ?? {}) as Record<string, any>;
  const detail = (e.detail ?? {}) as Record<string, any>;
  const num = (...vals: unknown[]): number => {
    for (const v of vals) if (typeof v === 'number') return v;
    return 0;
  };
  return {
    type: typeof e.type === 'string' ? e.type : '',
    detail,
    id: typeof target.id === 'string' ? target.id : '',
    dataset: (target.dataset ?? {}) as Record<string, any>,
    x: num(touch.clientX, detail.x),
    y: num(touch.clientY, detail.y),
    timeStamp: typeof e.timeStamp === 'number' ? e.timeStamp : 0,
  };
}
