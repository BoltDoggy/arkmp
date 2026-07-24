# 01. 总体设计

## 定位

```text
┌────────────────────────────────────────────────┐
│  开发者编写：ArkUI / ArkTS（声明式 UI 子集）      │
├────────────────────────────────────────────────┤
│  ArkMP 编译器                                   │
│  parse → 语义分析 → IR → transform → emit      │
├────────────────────────────────────────────────┤
│  产物：标准微信小程序工程                         │
│  WXML + WXSS + JS + JSON + @arkmp/runtime      │
└────────────────────────────────────────────────┘
```

与 Taro 的对比：

| 维度 | Taro | ArkMP |
| --- | --- | --- |
| 输入语法 | React JSX / Vue | ArkUI 声明式（ArkTS 子集） |
| 输出端 | 多端（weapp/h5/鸿蒙…） | 仅微信小程序 |
| 转换策略 | 运行时重（VDOM 模拟） | 编译期重（直出 WXML） |
| 产物可读性 | 较低（runtime 包裹） | 高（接近手写小程序） |

只做一个输出端，是 ArkMP 能把转换做"深"的前提：不需要为抽象多端差异引入 VDOM 层，build() 可以直接翻译成 WXML。

## 编译管线总览

```text
.ets 源码
   │
   ▼
① parse            TypeScript Compiler API 解析为 AST
   │               （ArkTS 装饰器语法与 TS 兼容，可直接解析）
   ▼
② analyze          提取组件模型：装饰器、状态字段、生命周期、build() 结构
   ▼
③ IR（中间表示）    与语法无关的组件描述：
   │               ComponentIR { state, props, lifecycle, uiTree, styles, events }
   ▼
④ transform        四条并行转换链：
   │               ├─ uiTree   → WXML 模板（见 03 篇）
   │               ├─ styles   → WXSS + 内联 style（见 04 篇）
   │               ├─ state    → data + 桥接逻辑（见 05 篇）
   │               └─ events   → bind/catch 事件表
   ▼
⑤ emit             生成 wxml / wxss / js / json，写入输出目录
   ▼
⑥ runtime 注入     注入 @arkmp/runtime（状态桥接、工具函数）
```

设计取舍：

- **编译期 vs 运行时**：凡能静态确定的（组件映射、样式属性、事件绑定）全部编译期完成；运行时只负责"状态赋值 → setData"的桥接与少量规范化。
- **IR 层存在的意义**：隔离 ArkTS 语法解析与小程序产物生成，未来若输入端扩展（如支持 ArkUI-X 语法变体）或输出端变化（如字节小程序），只需替换前端或后端。

## 两种编译粒度

ArkMP 支持两种使用方式：

### 1. 全量工程模式（init 脚手架）

```bash
ark-mp init my-app          # 生成 ArkUI 源码工程骨架
ark-mp dev                  # watch 编译 + 唤起微信开发者工具
ark-mp build                # 产物构建，输出 dist/ 标准小程序工程
```

工程内所有页面用 `.ets` 编写，ArkMP 生成完整小程序工程（含 app.json、project.config.json）。

### 2. 单文件嵌入模式（渐进接入已有小程序）

```bash
ark-mp compile src/components/UserCard.ets --out miniprogram/components/
```

把单个 ArkUI 组件编译为小程序自定义组件，放进已有小程序工程使用。产物不依赖 ArkMP 工程结构，只依赖 runtime 单文件。

## 产物目录约定

```text
dist/                          # 编译产物（标准小程序工程）
├── app.js                     # 由 app.ets 生成
├── app.json
├── app.wxss
├── pages/
│   └── index/
│       ├── index.wxml         # build() → 模板
│       ├── index.wxss         # 提取的样式
│       ├── index.js           # 状态/方法 + runtime 桥接
│       └── index.json         # 页面配置（来自装饰器参数）
├── components/                # 自定义组件产物
└── arkmp/
    └── runtime.js             # @arkmp/runtime 拷贝（单文件，<10KB）
```

## 核心难点与应对（详见后续各篇）

| 难点 | 应对策略 | 文档 |
| --- | --- | --- |
| `this.count++` 这类赋值如何触发 setData | 编译期改写顶层赋值 + 运行时 Proxy 兜底 | 05 篇 |
| 链式样式调用如何变成 CSS | 样式属性白名单 + 类名提取 + 内联兜底 | 04 篇 |
| 双向绑定 `@Link` | 编译为 properties + triggerEvent 对 | 05 篇 |
| 布局容器语义（Column/Row） | 映射为带 class 的 view + WXSS flex | 03 篇 |
| ArkTS 严格类型与小程序 JS 的差异 | 定义可编译子集，越界语法编译期报错 | 08 篇 |
