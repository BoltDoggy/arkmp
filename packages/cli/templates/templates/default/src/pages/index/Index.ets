@Entry({ title: '首页' })
@Component
struct Index {
  @State count: number = 0;

  build() {
    Column({ space: 12 }) {
      UserCard({ name: '{{projectName}}' })
      Text(`count=${this.count}`).fontSize(20)
    }
  }
}
