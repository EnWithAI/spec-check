workspace "Invitations" {
  model {
    admin = person "Admin"
    app = softwareSystem "Invitations"
    admin -> app "Invites teammates"
  }
}
