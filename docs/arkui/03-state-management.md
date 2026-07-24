# 03. 状态管理

ArkUI 通过装饰器标记状态变量，状态变化时自动刷新绑定的 UI。理解各装饰器的数据流向是写好 ArkUI 的关键。

## 装饰器速查表

| 装饰器 | 作用域 | 数据流向 | 典型场景 |
| --- | --- | --- | --- |
| `@State` | 组件内部 | 组件私有，变化驱动自身刷新 | 组件自身状态 |
| `@Prop` | 父 → 子 | 单向同步（父变子跟着变，子改不影响父） | 子组件只读父组件状态 |
| `@Link` | 父 ↔ 子 | 双向绑定 | 父子共享同一份状态 |
| `@Provide` / `@Consume` | 祖先 → 后代 | 跨层级双向绑定 | 深层组件通信 |
| `@Observed` / `@ObjectLink` | 类实例 | 观察嵌套对象变化 | 复杂数据模型 |
| `@Watch` | 配合上述装饰器 | 监听状态变化回调 | 状态联动副作用 |
| `@StorageLink` / `@StorageProp` | 应用全局 | 与 AppStorage 双向/单向绑定 | 全局状态 |

## @State：组件内部状态

```ts
@Component
struct Counter {
  @State count: number = 0;

  build() {
    Button(`count = ${this.count}`)
      .onClick(() => {
        this.count++;  // 修改后自动刷新 UI
      })
  }
}
```

注意点：

- `@State` 变量必须通过 `this.xxx` 访问。
- 直接整体赋值才触发刷新；对数组 `push`、对象属性的深层修改默认**不触发**刷新（嵌套观察需要 `@Observed`/`@ObjectLink`）。

```ts
@State list: number[] = [1, 2, 3];

// 触发刷新
this.list = [...this.list, 4];

// 不触发刷新（避免这样写）
this.list.push(4);
```

## @Prop：父到子的单向同步

```ts
@Component
struct Child {
  @Prop value: number;  // 父组件传入

  build() {
    Text(`子组件 value = ${this.value}`)
  }
}

@Entry
@Component
struct Parent {
  @State count: number = 0;

  build() {
    Column() {
      Text(`父组件 count = ${this.count}`)
      Child({ value: this.count })
      Button('父组件 +1').onClick(() => { this.count++; })
    }
  }
}
```

父组件 `count` 变化时，子组件 `value` 同步更新；子组件内部对 `value` 的修改是本地副本，不会回写父组件。

## @Link：父子双向绑定

```ts
@Component
struct SwitchChild {
  @Link isOn: boolean;  // 不需要初始化，由父组件传入引用

  build() {
    Toggle({ type: ToggleType.Switch, isOn: this.isOn })
      .onChange((on: boolean) => {
        this.isOn = on;  // 修改会同步回父组件
      })
  }
}

@Entry
@Component
struct Parent {
  @State masterSwitch: boolean = false;

  build() {
    Column() {
      Text(`开关：${this.masterSwitch ? '开' : '关'}`)
      SwitchChild({ isOn: $masterSwitch })  // 使用 $ 创建引用
    }
  }
}
```

要点：`@Link` 变量不能在子组件中初始化，父组件传参使用 `$变量名` 建立引用。

## @Provide / @Consume：跨层级传递

祖先组件用 `@Provide` 提供数据，任意深度的后代用 `@Consume` 消费，自动按变量名匹配：

```ts
@Entry
@Component
struct GrandParent {
  @Provide themeColor: string = '#007DFF';

  build() {
    Column() {
      Parent()
    }
  }
}

@Component
struct Parent {
  build() {
    Child()  // 中间层无需透传
  }
}

@Component
struct Child {
  @Consume themeColor: string;  // 自动匹配祖先的 @Provide

  build() {
    Text('深层组件').fontColor(this.themeColor)
  }
}
```

## @Observed / @ObjectLink：观察嵌套对象

当状态是嵌套的类实例时，需要 `@Observed` 让框架感知其属性变化：

```ts
@Observed
class Task {
  title: string;
  done: boolean = false;

  constructor(title: string) {
    this.title = title;
  }
}

@Component
struct TaskItem {
  @ObjectLink task: Task;

  build() {
    Row() {
      Text(this.task.title)
      Checkbox().select(this.task.done)
        .onChange((v: boolean) => {
          this.task.done = v;  // 属性修改可触发刷新
        })
    }
  }
}

@Entry
@Component
struct TaskPage {
  @State tasks: Task[] = [new Task('写文档'), new Task('评审代码')];

  build() {
    List({ space: 8 }) {
      ForEach(this.tasks, (task: Task) => {
        ListItem() {
          TaskItem({ task: task })
        }
      }, (task: Task) => task.title)
    }
  }
}
```

## @Watch：监听状态变化

```ts
@Entry
@Component
struct Index {
  @State @Watch('onCountChange') count: number = 0;

  onCountChange(propName: string): void {
    console.info(`${propName} 变化为 ${this.count}`);
  }

  build() {
    Button(`count=${this.count}`)
      .onClick(() => { this.count++; })
  }
}
```

`@Watch` 适合做日志、埋点、状态联动，不适合在里面再大规模修改其他状态（容易引发循环刷新）。

## 选型建议

- 只影响组件自身 → `@State`
- 子组件只读父组件数据 → `@Prop`
- 子组件需要回写父组件 → `@Link`
- 跨多层级共享 → `@Provide` / `@Consume`
- 应用全局（如登录状态、主题）→ `@StorageLink` / AppStorage
