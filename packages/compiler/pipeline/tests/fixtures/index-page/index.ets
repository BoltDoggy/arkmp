@Entry
@Component
struct Index {
  @State count: number = 0;

  build() {
    Column({ space: 12 }) {
      Text(`点击次数：${this.count}`).fontSize(20)
      Button('点我 +1').onClick(() => { this.count++; })
    }
    .width('100%')
    .justifyContent(FlexAlign.Center)
  }
}
