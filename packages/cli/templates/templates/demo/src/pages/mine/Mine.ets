@Entry({ title: '我的' })
@Component
struct Mine {
  @State nickname: string = 'ArkMP 用户';

  build() {
    Column({ space: 8 }) {
      Text(this.nickname).fontSize(18)
    }
  }
}
