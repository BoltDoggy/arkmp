/// <reference path="../index.d.ts" />
import { expectAssignable, expectError, expectType } from 'tsd';

// ---------------------------------------------------------------------------
// 装饰器参数签名（08 篇装饰器白名单）
// ---------------------------------------------------------------------------

// @Entry 支持裸用与带参两种形式
expectAssignable<ClassDecorator>(Entry);
expectType<ClassDecorator>(Entry({ routeName: 'pages/detail' }));
expectError(Entry({ routeName: 123 }));
expectError(Entry({ unknown: true }));

// 类/属性/方法装饰器类型
expectAssignable<ClassDecorator>(Component);
expectAssignable<ClassDecorator>(Observed);
expectAssignable<PropertyDecorator>(State);
expectAssignable<PropertyDecorator>(Prop);
expectAssignable<PropertyDecorator>(Link);
expectAssignable<PropertyDecorator>(Provide);
expectAssignable<PropertyDecorator>(Consume);
expectAssignable<PropertyDecorator>(ObjectLink);
expectAssignable<MethodDecorator>(Builder);

// 带参装饰器：参数必须为字符串字面量类型
expectType<PropertyDecorator>(StorageLink('userToken'));
expectError(StorageLink(42));
expectType<MethodDecorator>(Watch('count'));
expectError(Watch(0));

// @Extend 参数为目标组件构造引用
expectType<(target: (...args: never[]) => void) => void>(Extend(Text));

// ---------------------------------------------------------------------------
// 组件链式调用（03/04 篇组件与样式清单）
// ---------------------------------------------------------------------------

// Text 链式方法返回自身类型
expectType<TextAttribute>(Text('标题').fontSize(16).fontColor('#333').maxLines(1));
expectError(Text('标题').fontSize(true));
expectError(Text(123));

// 布局容器与对齐枚举
expectType<ColumnAttribute>(
  Column({ space: 12 }).alignItems(HorizontalAlign.Center).justifyContent(FlexAlign.SpaceBetween),
);
expectError(Column({ space: 12 }).alignItems(VerticalAlign.Center));
expectType<RowAttribute>(Row({ space: 8 }).alignItems(VerticalAlign.Center).width('100%'));
expectError(Row({ space: 'x' }).justifyContent(123));

// 公共修饰符白名单
expectType<StackAttribute>(
  Stack().position({ x: 10, y: 20 }).zIndex(2).visibility(Visibility.Hidden).opacity(0.5),
);
expectError(Stack().opacity('half'));
expectError(Stack().unknownModifier(1));

// Image / Button / TextInput 事件回调签名
expectType<ImageAttribute>(Image($r('app.media.logo')).objectFit(ImageFit.Cover));
expectType<ButtonAttribute>(Button('确定').onClick((e) => {}).fontSize(14));
TextInput({ placeholder: '输入' }).onChange((value) => {
  expectType<string>(value);
});
TextInput().onChange((value) => {
  expectError(value.toFixed(2));
});

// Toggle 参数对象
expectType<ToggleAttribute>(Toggle({ type: ToggleType.Switch, isOn: true }));
expectError(Toggle({ isOn: true }));

// ---------------------------------------------------------------------------
// ForEach 回调签名（03 篇"控制流翻译"）
// ---------------------------------------------------------------------------

interface Item {
  id: string;
  title: string;
}

declare const items: Item[];

ForEach(
  items,
  (item, index) => {
    expectType<Item>(item);
    expectType<number>(index);
    Text(item.title);
  },
  (item) => item.id,
);

// 键生成函数可省略
ForEach(items, (item) => {
  Text(item.title);
});

// 键生成函数必须返回 string
expectError(
  ForEach(items, (item) => {
    Text(item.title);
  }, (item) => item.title.length),
);

// 数据源必须是数组
expectError(ForEach('not-array', (item) => {}));

// ---------------------------------------------------------------------------
// 路由 API（06 篇路由适配）
// ---------------------------------------------------------------------------

router.push({ name: 'Detail', param: { id: 1 } });
expectError(router.push({ param: 1 }));
router.back();
expectError(router.back(1));
