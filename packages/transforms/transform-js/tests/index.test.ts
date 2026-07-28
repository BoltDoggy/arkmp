import { describe, expect, it } from 'vitest';
import type { ComponentModel } from '@arkmp/ir';
import { transformJs, TRANSFORM_JS_WARNING_CODES } from '../src/index';
import { REWRITE_WARNING_CODES } from '../src/rewrite';

function model(partial: Partial<ComponentModel>): ComponentModel {
  return {
    name: 'Index',
    isEntry: true,
    states: [],
    props: [],
    lifecycle: {},
    methods: [],
    buildTree: { type: 'component', component: 'Column', params: [], children: [], styleCalls: [], eventCalls: [] },
    builders: {},
    ...partial,
  };
}

describe('T23 @State → data + 赋值改写', () => {
  it('基本页面：state 初始值 + 自增改写快照', () => {
    const { js, diagnostics } = transformJs(
      model({
        states: [
          { name: 'count', type: 'number', initialValue: { kind: 'static', value: 0 } },
          { name: 'list', type: 'string[]', initialValue: { kind: 'static', value: [] } },
        ],
        methods: [{ name: 'inc', params: [], body: 'this.count++;' }],
      }),
    );
    expect(diagnostics).toEqual([]);
    expect(js).toMatchSnapshot();
  });

  it('赋值改写全形态：= / += / 嵌套路径 / 下标 / ++', () => {
    const { js, diagnostics } = transformJs(
      model({
        states: [
          { name: 'count', type: 'number', initialValue: { kind: 'static', value: 0 } },
          { name: 'user', type: 'User', initialValue: { kind: 'static', value: { name: '' } } },
          { name: 'list', type: 'number[]', initialValue: { kind: 'static', value: [] } },
        ],
        methods: [
          {
            name: 'run',
            params: [],
            body: [
              'this.count = 1;',
              'this.count += 2;',
              "this.user.name = 'x';",
              'this.list[0] = 9;',
              'this.count--;',
            ].join('\n'),
          },
        ],
      }),
    );
    expect(diagnostics).toEqual([]);
    expect(js).toContain("this.__set('count', 1);");
    expect(js).toContain("this.__set('count', this.count + (2));");
    expect(js).toContain("this.__set('user.name', 'x');");
    expect(js).toContain("this.__set('list[0]', 9);");
    expect(js).toContain("this.__set('count', this.count - 1);");
    expect(js).toMatchSnapshot();
  });

  it('动态键访问保留原写法并 warning（W2001，Proxy 兜底）', () => {
    const { js, diagnostics } = transformJs(
      model({
        states: [{ name: 'list', type: 'number[]', initialValue: { kind: 'static', value: [] } }],
        methods: [{ name: 'run', params: ['i'], body: 'this.list[i] = 9;' }],
      }),
    );
    expect(js).toContain('this.list[i] = 9;');
    expect(js).not.toContain('__set(');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe(REWRITE_WARNING_CODES.DYNAMIC_FALLBACK);
  });

  it('初始值为 binding 表达式：降级 null + W2002', () => {
    const { js, diagnostics } = transformJs(
      model({
        states: [{ name: 'count', type: 'number', initialValue: { kind: 'binding', path: 'other' } }],
      }),
    );
    expect(js).toContain('count: null,');
    expect(diagnostics[0].code).toBe(TRANSFORM_JS_WARNING_CODES.NON_STATIC_INITIAL_VALUE);
  });

  it('非状态字段的赋值不改写', () => {
    const { js, diagnostics } = transformJs(
      model({
        states: [{ name: 'count', type: 'number', initialValue: { kind: 'static', value: 0 } }],
        methods: [{ name: 'run', params: [], body: 'this.temp = 1;\nthis.count = 2;' }],
      }),
    );
    expect(diagnostics).toEqual([]);
    expect(js).toContain('this.temp = 1;');
    expect(js).toContain("this.__set('count', 2);");
  });
});

describe('T24 @Prop / @Link → properties', () => {
  it('@Prop：完整形式（带默认值）与简写形式', () => {
    const { js, diagnostics } = transformJs(
      model({
        isEntry: false,
        name: 'Child',
        props: [
          { name: 'value', type: 'number', kind: 'prop', initialValue: { kind: 'static', value: 0 } },
          { name: 'label', type: 'string', kind: 'prop' },
        ],
      }),
    );
    expect(diagnostics).toEqual([]);
    expect(js).toContain('const { createComponent } = require');
    expect(js).toContain('value: { type: Number, value: 0 },');
    expect(js).toContain('label: String,');
    expect(js).toMatchSnapshot();
  });

  it('@Link：properties + __set 桥接方法 + 赋值改写为桥接调用', () => {
    const { js, diagnostics } = transformJs(
      model({
        isEntry: false,
        name: 'Switch',
        props: [{ name: 'isOn', type: 'boolean', kind: 'link' }],
        methods: [{ name: 'toggle', params: [], body: 'this.isOn = !this.isOn;' }],
      }),
    );
    expect(diagnostics).toEqual([]);
    expect(js).toContain('isOn: Boolean,');
    expect(js).toContain('__set_isOn(v) {');
    expect(js).toContain('this.setData({ isOn: v });');
    expect(js).toContain("this.triggerEvent('update:ison', v);");
    expect(js).toContain('this.__set_isOn(!this.isOn);');
    expect(js).toMatchSnapshot();
  });

  it('plain 普通成员：不进 properties，初始值进 data 段（非响应式）', () => {
    const { js } = transformJs(
      model({
        isEntry: false,
        props: [
          { name: 'cache', type: 'Map<string,number>', kind: 'plain' },
          { name: 'label', type: 'string', kind: 'plain', initialValue: { kind: 'static', value: 'hi' } },
        ],
      }),
    );
    expect(js).not.toContain('properties');
    expect(js).not.toContain('state');
    expect(js).toContain('data: {');
    expect(js).toContain('cache: null,');
    expect(js).toContain('label: "hi",');
  });
});

describe('T25 生命周期映射 + 方法抽取', () => {
  it('页面：钩子以 ArkUI 名称入 methods，aboutToAppear 带 options', () => {
    const { js, diagnostics } = transformJs(
      model({
        isEntry: true,
        lifecycle: {
          aboutToAppear: 'this.load();',
          onPageShow: 'console.log(1);',
          onDidBuild: '',
          onPageHide: '',
          aboutToDisappear: 'this.dispose();',
        },
        methods: [{ name: 'load', params: [], body: 'this.ready = true;' }],
      }),
    );
    expect(diagnostics).toEqual([]);
    expect(js).toContain('aboutToAppear(options) {');
    expect(js).toContain('onPageShow() {');
    expect(js).toContain('onDidBuild() {},');
    expect(js).toContain('aboutToDisappear() {');
    expect(js).toMatchSnapshot();
  });

  it('组件：仅 aboutToAppear / onDidBuild / aboutToDisappear 三个钩子', () => {
    const { js, diagnostics } = transformJs(
      model({
        isEntry: false,
        lifecycle: {
          aboutToAppear: 'this.init();',
          onPageShow: 'console.log(1);', // 组件侧无此钩子，应被忽略
          onDidBuild: '',
        },
      }),
    );
    expect(diagnostics).toEqual([]);
    expect(js).toContain('aboutToAppear() {');
    expect(js).not.toContain('onPageShow');
    expect(js).toMatchSnapshot();
  });

  it('isPage 选项可覆盖 isEntry', () => {
    const { js } = transformJs(model({ isEntry: false }), { isPage: true });
    expect(js).toContain('createPage');
  });

  it('onPullRefresh 钩子出现在 methods 中', () => {
    const { js, diagnostics } = transformJs(
      model({
        isEntry: true,
        lifecycle: { onPullRefresh: 'this.refresh();' },
      }),
    );
    expect(diagnostics).toEqual([]);
    expect(js).toContain('onPullRefresh() {');
  });
});

describe('T26 @Watch → watch 表', () => {
  it('带 @Watch 的 @State 生成 watch 表，回调方法原样进 methods', () => {
    const { js, diagnostics } = transformJs(
      model({
        states: [
          { name: 'count', type: 'number', initialValue: { kind: 'static', value: 0 }, watch: 'onCountChange' },
          { name: 'flag', type: 'boolean', initialValue: { kind: 'static', value: false } },
        ],
        methods: [{ name: 'onCountChange', params: ['value', 'key'], body: 'console.log(value);' }],
      }),
    );
    expect(diagnostics).toEqual([]);
    expect(js).toContain("watch: {\n    count: 'onCountChange',\n  },");
    expect(js).toContain('onCountChange(value, key) {');
    expect(js).toMatchSnapshot();
  });
});

describe('与 transform-events 的合并协议', () => {
  it('eventMethods 经同一套改写后并入 methods 末尾', () => {
    const { js, diagnostics } = transformJs(
      model({
        states: [{ name: 'count', type: 'number', initialValue: { kind: 'static', value: 0 } }],
        methods: [{ name: 'submit', params: [], body: 'this.count = 0;' }],
      }),
      { eventMethods: { __n7_click: { body: 'this.count++;\nthis.submit();' } } },
    );
    expect(diagnostics).toEqual([]);
    expect(js).toContain("__n7_click() {\n      this.__set('count', this.count + 1);\n      this.submit();\n    },");
    // 声明方法在前，事件方法在后
    expect(js.indexOf('submit()')).toBeLessThan(js.indexOf('__n7_click'));
    expect(js).toMatchSnapshot();
  });

  it('ForEach 内的事件方法：loopVars → e 参数 + 变量引用改写', () => {
    const { js, diagnostics } = transformJs(
      model({
        states: [{ name: 'list', type: 'string[]', initialValue: { kind: 'static', value: [] } }],
      }),
      {
        eventMethods: {
          __n3_click: { body: 'this.goDetail(r.id);', loopVars: ['r'] },
        },
      },
    );
    expect(diagnostics).toEqual([]);
    // 方法带 e 参数
    expect(js).toContain('__n3_click(e) {');
    // 循环变量 r 改写为 dataset 读取
    expect(js).toContain('this.goDetail(e.currentTarget.dataset.r.id);');
    expect(js).not.toContain('(r.id)');
  });

  it('ForEach 嵌套：多层循环变量全部改写', () => {
    const { js } = transformJs(
      model({}),
      {
        eventMethods: {
          __n5_click: { body: 'this.handle(outer.id, inner.name, index);', loopVars: ['outer', 'inner', 'index'] },
        },
      },
    );
    expect(js).toContain('__n5_click(e) {');
    expect(js).toContain('e.currentTarget.dataset.outer.id');
    expect(js).toContain('e.currentTarget.dataset.inner.name');
    expect(js).toContain('e.currentTarget.dataset.index');
  });
});
