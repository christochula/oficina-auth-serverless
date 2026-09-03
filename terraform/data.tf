data "aws_partition" "current" {}
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

data "archive_file" "auth" {
  type        = "zip"
  source_file = "${path.root}/../.build/handler.js"
  output_path = "${path.root}/.artifacts/auth.zip"
}

data "archive_file" "authorizer" {
  type        = "zip"
  source_file = "${path.root}/../.build/authorizer.js"
  output_path = "${path.root}/.artifacts/authorizer.zip"
}

data "archive_file" "notification" {
  count       = var.notification_enabled ? 1 : 0
  type        = "zip"
  source_file = "${path.root}/../.build/notification.js"
  output_path = "${path.root}/.artifacts/notification.zip"
}
