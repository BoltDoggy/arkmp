# 06. 页面路由与导航

HarmonyOS 提供两套页面导航方案：

- **Router（页面路由）**：基于 `@Entry` 页面的传统方案，API 简单。
- **Navigation（导航组件）**：API 12 起推荐的方案，基于组件级导航，支持路由表、跨包跳转、更灵活的转场。

## Router：页面路由

### 注册页面

页面路径需在 `entry/src/main/resources/base/profile/main_pages.json` 中声明：

```json
{
  "src": [
    "pages/Index",
    "pages/Detail"
  ]
}
```

### 跳转与传参

```ts
import { router } from '@kit.ArkUI';

// 跳转到 Detail 页面并传参
router.pushUrl({
  url: 'pages/Detail',
  params: { id: 100, title: '详情' }
});

// 替换当前页（不可返回到当前页）
router.replaceUrl({ url: 'pages/Login' });

// 返回上一页
router.back();

// 返回到指定页面
router.back({ url: 'pages/Index' });
```

### 接收参数

目标页面在 `aboutToAppear` 或 build 前通过 `router.getParams()` 获取：

```ts
@Entry
@Component
struct Detail {
  @State id: number = 0;

  aboutToAppear(): void {
    const params = router.getParams() as Record<string, Object>;
    this.id = params['id'] as number;
  }

  build() {
    Text(`详情页 id=${this.id}`)
  }
}
```

### 返回时回传数据

```ts
// 上一页
router.back({
  url: 'pages/Index',
  params: { refresh: true }
});
```

## Navigation：导航组件（推荐）

Navigation 是一个导航容器组件，配合 `NavDestination` 子页面使用，不再依赖 `@Entry` 页面粒度。

### 基本结构

```ts
@Entry
@Component
struct Index {
  private navStack: NavPathStack = new NavPathStack();

  build() {
    Navigation(this.navStack) {
      Column({ space: 12 }) {
        Text('首页')
        Button('去详情')
          .onClick(() => {
            this.navStack.pushPath({ name: 'Detail', param: { id: 1 } });
          })
      }
      .width('100%').height('100%')
    }
    .title('首页')
    .mode(NavigationMode.Stack)
  }
}
```

### 子页面 NavDestination

```ts
@Component
struct DetailPage {
  @State id: number = 0;

  build() {
    NavDestination() {
      Text(`详情 id=${this.id}`)
    }
    .title('详情')
    .onReady((ctx: NavDestinationContext) => {
      this.id = (ctx.pathInfo.param as Record<string, number>)['id'];
    })
  }
}
```

### 路由表注册（API 12+ 推荐）

在 `module.json5` 中配置 `routerMap`，并在 `resources/base/profile/router_map.json` 中声明页面：

```json
{
  "routerMap": [
    {
      "name": "Detail",
      "pageSourceFile": "src/main/ets/pages/DetailPage.ets",
      "buildFunction": "DetailPageBuilder"
    }
  ]
}
```

```ts
// DetailPage.ets
@Builder
export function DetailPageBuilder() {
  DetailPage()
}
```

之后即可通过 `navStack.pushPath({ name: 'Detail' })` 跳转，无需手动维护组件映射表。

### 常用操作

```ts
// 出栈（返回）
this.navStack.pop();

// 出栈并带回结果
this.navStack.pop(result);

// 清空回首页
this.navStack.clear();

// 替换栈顶
this.navStack.replacePath({ name: 'Login' });
```

## 两套方案对比

| 维度 | Router | Navigation |
| --- | --- | --- |
| 粒度 | 页面（@Entry） | 组件（NavDestination） |
| 配置 | main_pages.json | router_map.json（路由表） |
| 转场动画 | 固定 | 可定制（NavDestination 级） |
| 分栏适配 | 不支持 | 支持 `NavigationMode.Split`（折叠屏/平板双栏） |
| 官方定位 | 兼容存量 | 新应用推荐 |

> 新项目建议直接使用 Navigation + 路由表方案；老项目可在现有 Router 基础上渐进迁移。
