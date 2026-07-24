# 04. 常用组件

## 文本类

### Text / Span

```ts
Text('普通文本')
  .fontSize(20)
  .fontColor('#333333')
  .fontWeight(FontWeight.Bold)
  .maxLines(2)
  .textOverflow({ overflow: TextOverflow.Ellipsis })

// 富文本：Text 内嵌 Span
Text() {
  Span('价格：')
  Span('¥99.00').fontColor(Color.Red).fontSize(24)
}
```

## 按钮与交互

### Button

```ts
Button('主要按钮', { type: ButtonType.Capsule, stateEffect: true })
  .backgroundColor('#007DFF')
  .onClick(() => {
    console.info('clicked');
  })

// 按钮也可以包裹任意子组件
Button({ type: ButtonType.Circle }) {
  Image($r('app.media.icon_add')).width(24).height(24)
}
```

`stateEffect: true` 开启按压态效果（默认点击有缩放/变色反馈）。

### Toggle / Checkbox / Radio

```ts
Toggle({ type: ToggleType.Switch, isOn: this.isOn })
  .onChange((on: boolean) => { this.isOn = on; })

Checkbox().select(this.checked)
  .onChange((v: boolean) => { this.checked = v; })

Radio({ value: 'option1', group: 'g1' }).checked(this.selected === 'option1')
```

## 输入

### TextInput / TextArea

```ts
@State text: string = '';

TextInput({ placeholder: '请输入用户名', text: this.text })
  .type(InputType.Normal)            // Normal / Number / Password / Email 等
  .onChange((value: string) => {
    this.text = value;
  })

TextArea({ placeholder: '多行输入', text: this.text })
  .onChange((value: string) => { this.text = value; })
```

获取输入一般用 `onChange` 回写到状态；也可用 `$$this.text` 双向绑定（`TextInput({ text: $$this.text })`）。

## 图片

### Image

```ts
// 本地资源
Image($r('app.media.avatar'))
  .width(80).height(80)
  .borderRadius(40)
  .objectFit(ImageFit.Cover)

// 网络图片（需要 ohos.permission.INTERNET 权限）
Image('https://example.com/pic.png')
  .alt($r('app.media.placeholder'))   // 加载失败占位图
```

## 滚动与列表

### Scroll

```ts
Scroll() {
  Column({ space: 12 }) {
    // 任意子组件
  }
}
.scrollable(ScrollDirection.Vertical)
```

### List / ListItem

```ts
List({ space: 10 }) {
  ForEach(this.items, (item: string) => {
    ListItem() {
      Text(item).width('100%').padding(12)
    }
    .swipeAction({ end: this.deleteButton(item) })  // 侧滑删除
  }, (item: string) => item)
}
.listDirection(Axis.Vertical)
.divider({ strokeWidth: 1, color: '#EEEEEE' })

@Builder
deleteButton(item: string) {
  Button('删除').backgroundColor(Color.Red)
    .onClick(() => { /* 删除逻辑 */ })
}
```

### Grid / GridItem

```ts
Grid() {
  ForEach(this.apps, (app: string) => {
    GridItem() {
      Column() {
        Image($r('app.media.icon')).width(48).height(48)
        Text(app).fontSize(12)
      }
    }
  }, (app: string) => app)
}
.columnsTemplate('1fr 1fr 1fr 1fr')   // 4 列
.rowsGap(12).columnsGap(12)
```

## 弹层

### AlertDialog

```ts
Button('删除').onClick(() => {
  AlertDialog.show({
    title: '确认删除？',
    message: '删除后不可恢复',
    primaryButton: {
      value: '取消',
      action: () => {}
    },
    secondaryButton: {
      value: '删除',
      fontColor: Color.Red,
      action: () => { this.doDelete(); }
    }
  });
})
```

### 自定义弹窗 @CustomDialog

```ts
@CustomDialog
struct ConfirmDialog {
  controller: CustomDialogController;

  build() {
    Column({ space: 16 }) {
      Text('自定义弹窗内容')
      Button('关闭').onClick(() => { this.controller.close(); })
    }
    .padding(24)
  }
}

// 使用
dialogController: CustomDialogController = new CustomDialogController({
  builder: ConfirmDialog(),
  alignment: DialogAlignment.Center,
});

// 打开
this.dialogController.open();
```

## 进度与加载

```ts
Progress({ value: this.progress, total: 100, type: ProgressType.Ring })
LoadingProgress().width(40).height(40)
```

## 其他高频组件

| 组件 | 用途 |
| --- | --- |
| `Blank` | 填充剩余空间（常用于两端对齐布局） |
| `Divider` | 分割线 |
| `Badge` | 角标（消息数提示） |
| `Tabs` / `TabContent` | 页签容器 |
| `Swiper` | 轮播图 |
| `Web` | 网页容器（需网络权限） |
