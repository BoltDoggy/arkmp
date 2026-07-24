@Component
struct UserCard {
  name: string = '';

  build() {
    Row() {
      Text(this.name)
    }
  }
}
