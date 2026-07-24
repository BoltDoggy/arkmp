import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BASE_WXSS,
  createComponent,
  createPage,
  normalizeEvent,
} from '../src/index.js';

/* ---------- 小程序环境 mock ---------- */

let lastPageConfig: Record<string, any> | undefined;
let lastComponentConfig: Record<string, any> | undefined;

function setDeep(data: Record<string, any>, path: string, value: unknown): void {
  const segs = path.replace(/\[(\w+)\]/g, '.$1').split('.');
  let node: any = data;
  for (let i = 0; i < segs.length - 1; i++) node = node[segs[i]];
  node[segs[segs.length - 1]] = value;
}

interface MockInstance {
  inst: any;
  setDataCalls: Record<string, unknown>[];
}

function createMockInstance(config: Record<string, any>, extraProto?: object): MockInstance {
  const setDataCalls: Record<string, unknown>[] = [];
  const inst: any = {
    setData(patch: Record<string, unknown>, cb?: () => void) {
      setDataCalls.push(patch);
      for (const k in patch) setDeep(inst.data, k, patch[k]);
      cb?.();
    },
  };
  // 组件实例 data = properties 默认值 + data
  const propDefaults: Record<string, unknown> = {};
  for (const key in config.properties ?? {}) {
    const def = config.properties[key];
    if (def !== null && typeof def === 'object' && 'value' in def) propDefaults[key] = def.value;
  }
  inst.data = { ...propDefaults, ...(config.data ?? {}) };
  Object.setPrototypeOf(inst, extraProto ?? config);
  return { inst, setDataCalls };
}

function bootPage(options: Parameters<typeof createPage>[0]) {
  createPage(options);
  expect(lastPageConfig).toBeDefined();
  const config = lastPageConfig!;
  const mock = createMockInstance(config);
  config.onLoad!.call(mock.inst, {});
  return { config, ...mock };
}

function bootComponent(options: Parameters<typeof createComponent>[0]) {
  createComponent(options);
  expect(lastComponentConfig).toBeDefined();
  const config = lastComponentConfig!;
  const proto = { ...config.methods };
  const mock = createMockInstance(config, proto);
  config.lifetimes!.attached!.call(mock.inst);
  return { config, ...mock };
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  lastPageConfig = undefined;
  lastComponentConfig = undefined;
  (globalThis as any).Page = vi.fn((c: any) => {
    lastPageConfig = c;
  });
  (globalThis as any).Component = vi.fn((c: any) => {
    lastComponentConfig = c;
  });
});

afterEach(() => {
  delete (globalThis as any).Page;
  delete (globalThis as any).Component;
  delete (globalThis as any).wx;
});

/* ---------- T36 createPage 基础桥接 ---------- */

describe('createPage', () => {
  it('state 映射为 data，methods 透传', () => {
    const greet = vi.fn();
    const { config } = bootPage({
      state: { count: 0, list: [] as number[] },
      methods: { greet },
    });
    expect(config.data).toEqual({ count: 0, list: [] });
    expect(config.greet).toBe(greet);
    expect((globalThis as any).Page).toHaveBeenCalledTimes(1);
  });

  it('ArkUI 生命周期映射到 Page 钩子', () => {
    const appear = vi.fn();
    const show = vi.fn();
    const { config, inst } = bootPage({
      state: {},
      methods: { aboutToAppear: appear, onPageShow: show },
    });
    expect(appear).toHaveBeenCalledTimes(1); // onLoad 包装内调用
    expect(typeof config.onShow).toBe('function');
    config.onShow!.call(inst);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('onPullRefresh 映射为 onPullDownRefresh 并自动 stopPullDownRefresh', () => {
    const stop = vi.fn();
    (globalThis as any).wx = { stopPullDownRefresh: stop };
    const refresh = vi.fn();
    const { config, inst } = bootPage({ state: {}, methods: { onPullRefresh: refresh } });
    config.onPullDownRefresh!.call(inst);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('额外原生配置（onShareAppMessage 等）透传', () => {
    const share = vi.fn();
    const { config } = bootPage({ state: {}, onShareAppMessage: share });
    expect(config.onShareAppMessage).toBe(share);
  });

  it('__set 桥接入口：写入经 setData 下发', async () => {
    const { inst, setDataCalls } = bootPage({ state: { count: 0 } });
    inst.__set('count', 5);
    expect(inst.data.count).toBe(5);
    await tick();
    expect(setDataCalls).toEqual([{ count: 5 }]);
  });

  it('__set 支持 a.b / a[0] 路径', async () => {
    const { inst, setDataCalls } = bootPage({ state: { user: { name: 'a' }, list: [1] } });
    inst.__set('user.name', 'b');
    inst.__set('list[0]', 9);
    expect(inst.data.user.name).toBe('b');
    expect(inst.data.list[0]).toBe(9);
    await tick();
    expect(setDataCalls).toEqual([{ 'user.name': 'b', 'list[0]': 9 }]);
  });

  it('全局 Page 缺失时报 [arkmp] 前缀错误', () => {
    delete (globalThis as any).Page;
    expect(() => createPage({ state: {} })).toThrow(/^\[arkmp\] /);
  });
});

/* ---------- T36/T37 赋值桥接 + Proxy 兜底 ---------- */

describe('状态赋值桥接', () => {
  it('this.count = 1 式写入桥接到 setData（编译期改写兜底）', async () => {
    const { inst, setDataCalls } = bootPage({ state: { count: 0 } });
    inst.count = 1;
    await tick();
    expect(inst.data.count).toBe(1);
    expect(setDataCalls).toEqual([{ count: 1 }]);
  });

  it('同一 tick 多次写入合并为一次 setData', async () => {
    const { inst, setDataCalls } = bootPage({ state: { count: 0, name: 'a' } });
    inst.count = 1;
    inst.count = 2;
    inst.name = 'b';
    await tick();
    expect(setDataCalls).toEqual([{ count: 2, name: 'b' }]);
  });

  it('嵌套对象赋值经 Proxy 兜底（根字段整体下发）', async () => {
    const { inst, setDataCalls } = bootPage({ state: { user: { name: 'a', age: 1 } } });
    inst.user.name = 'x';
    expect(inst.data.user.name).toBe('x');
    await tick();
    expect(setDataCalls).toEqual([{ user: { name: 'x', age: 1 } }]);
  });

  it('数组下标赋值与 push 均触发 setData', async () => {
    const { inst, setDataCalls } = bootPage({ state: { list: [1, 2] } });
    inst.list[0] = 9;
    await tick();
    expect(inst.data.list).toEqual([9, 2]);
    inst.list.push(3);
    await tick();
    expect(inst.data.list).toEqual([9, 2, 3]);
    expect(setDataCalls).toHaveLength(2);
  });

  it('嵌套修改后读取返回最新值', async () => {
    const { inst } = bootPage({ state: { user: { name: 'a' } } });
    inst.user.name = 'b';
    expect(inst.user.name).toBe('b');
    await tick();
    expect(inst.user.name).toBe('b');
  });
});

/* ---------- T37 @Watch ---------- */

describe('@Watch 触发', () => {
  it('直接赋值时同步触发（字符串方法名）', async () => {
    const onCountChange = vi.fn();
    const { inst } = bootPage({
      state: { count: 0 },
      watch: { count: 'onCountChange' },
      methods: { onCountChange },
    });
    inst.count = 7;
    expect(onCountChange).toHaveBeenCalledWith(7, 'count');
    await tick();
    expect(onCountChange).toHaveBeenCalledTimes(1);
  });

  it('Proxy 兜底路径同步触发（嵌套写入，回调收到根字段值）', () => {
    const handler = vi.fn();
    const { inst } = bootPage({
      state: { user: { name: 'a' } },
      watch: { user: handler },
    });
    inst.user.name = 'x';
    expect(handler).toHaveBeenCalledWith({ name: 'x' }, 'user');
  });

  it('__set 路径同步触发', () => {
    const handler = vi.fn();
    const { inst } = bootPage({ state: { count: 0 }, watch: { count: handler } });
    inst.__set('count', 3);
    expect(handler).toHaveBeenCalledWith(3, 'count');
  });

  it('未监听的字段不触发；监听方法缺失时告警带 [arkmp] 前缀', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { inst } = bootPage({
      state: { a: 1, b: 2 },
      watch: { a: 'notExist' },
    });
    inst.b = 20;
    expect(warnSpy).not.toHaveBeenCalled();
    inst.a = 10;
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/^\[arkmp\] /));
    warnSpy.mockRestore();
  });
});

/* ---------- derived 派生字段 ---------- */

describe('derived 派生字段', () => {
  it('依赖变化后重算并 setData', async () => {
    const { inst, setDataCalls } = bootPage({
      state: { count: 0 },
      derived: { label: ['count', (d: any) => `共${d.count}次`] },
    });
    inst.count = 3;
    await tick();
    expect(inst.data.label).toBe('共3次');
    expect(setDataCalls).toEqual([{ count: 3 }, { label: '共3次' }]);
  });

  it('无关字段变化不重算', async () => {
    const fn = vi.fn((d: any) => `共${d.count}次`);
    const { inst } = bootPage({
      state: { count: 0, other: 'x' },
      derived: { label: ['count', fn] },
    });
    inst.other = 'y';
    await tick();
    expect(fn).not.toHaveBeenCalled();
    expect(inst.data.label).toBeUndefined();
  });

  it('非法 derived 配置报 [arkmp] 前缀错误', () => {
    expect(() =>
      createPage({ state: {}, derived: { bad: ['count'] as any } }),
    ).toThrow(/^\[arkmp\] /);
  });
});

/* ---------- T36 createComponent ---------- */

describe('createComponent', () => {
  it('state → data，properties 透传，methods 进入 methods 字段', () => {
    const tap = vi.fn();
    const { config, inst } = bootComponent({
      state: { inner: 1 },
      properties: { value: { type: Number, value: 0 } },
      methods: { tap },
    });
    expect(config.data).toEqual({ inner: 1 });
    expect(config.properties).toEqual({ value: { type: Number, value: 0 } });
    expect(config.methods.tap).toBe(tap);
    expect(inst.data).toEqual({ inner: 1, value: 0 });
  });

  it('生命周期方法映射到 lifetimes（aboutToAppear → attached）', () => {
    const readyFn = vi.fn();
    const { config, inst } = bootComponent({ state: {}, methods: { onDidBuild: readyFn } });
    expect(typeof config.lifetimes.ready).toBe('function');
    config.lifetimes.ready!.call(inst);
    expect(readyFn).toHaveBeenCalledTimes(1);
  });

  it('@Watch 标注的 property 生成 observers 桥接', () => {
    const onValueChange = vi.fn();
    const { config, inst } = bootComponent({
      state: {},
      properties: { value: { type: Number, value: 0 } },
      watch: { value: 'onValueChange' },
      methods: { onValueChange },
    });
    expect(typeof config.observers.value).toBe('function');
    config.observers.value!.call(inst, 42);
    expect(onValueChange).toHaveBeenCalledWith(42, 'value');
  });

  it('用户自定义 observers 与生成的桥接共存', () => {
    const userObserver = vi.fn();
    const watcher = vi.fn();
    const { config, inst } = bootComponent({
      state: {},
      properties: { value: Number },
      watch: { value: watcher },
      observers: { value: userObserver },
    });
    config.observers.value!.call(inst, 1);
    expect(userObserver).toHaveBeenCalledWith(1);
    expect(watcher).toHaveBeenCalledWith(1, 'value');
  });

  it('组件内 state 赋值同样桥接 setData', async () => {
    const { inst, setDataCalls } = bootComponent({ state: { inner: 1 } });
    inst.inner = 2;
    await tick();
    expect(inst.data.inner).toBe(2);
    expect(setDataCalls).toEqual([{ inner: 2 }]);
  });

  it('全局 Component 缺失时报 [arkmp] 前缀错误', () => {
    delete (globalThis as any).Component;
    expect(() => createComponent({ state: {} })).toThrow(/^\[arkmp\] /);
  });
});

/* ---------- T38 utils + WXSS ---------- */

describe('normalizeEvent', () => {
  it('tap 事件规范化（detail 取坐标）', () => {
    const e = normalizeEvent({
      type: 'tap',
      detail: { x: 10, y: 20 },
      currentTarget: { id: 'btn', dataset: { index: 3 } },
      timeStamp: 100,
    });
    expect(e).toEqual({
      type: 'tap',
      detail: { x: 10, y: 20 },
      id: 'btn',
      dataset: { index: 3 },
      x: 10,
      y: 20,
      timeStamp: 100,
    });
  });

  it('touch 事件规范化（touches 取坐标）', () => {
    const e = normalizeEvent({
      type: 'touchmove',
      touches: [{ clientX: 1, clientY: 2 }],
      target: { id: 'v', dataset: {} },
    });
    expect(e.x).toBe(1);
    expect(e.y).toBe(2);
    expect(e.id).toBe('v');
    expect(e.timeStamp).toBe(0);
  });

  it('非法事件对象报 [arkmp] 前缀错误', () => {
    expect(() => normalizeEvent(null as any)).toThrow(/^\[arkmp\] /);
  });
});

describe('BASE_WXSS', () => {
  it('包含内置基础类', () => {
    for (const cls of ['.arkmp-page', '.arkmp-col', '.arkmp-row', '.arkmp-text', '.arkmp-btn']) {
      expect(BASE_WXSS).toContain(cls);
    }
  });
});
