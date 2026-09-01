data "aws_partition" "current" {}
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

data "aws_secretsmanager_secret" "database" {
  arn = var.db_secret_arn
}

data "aws_secretsmanager_secret" "jwt" {
  arn = var.jwt_secret_arn
}

data "terraform_remote_state" "network" {
  count   = var.network_remote_state == null ? 0 : 1
  backend = "s3"

  config = {
    bucket = var.network_remote_state == null ? "" : var.network_remote_state.bucket
    key    = var.network_remote_state == null ? "" : var.network_remote_state.key
    region = var.network_remote_state == null ? var.aws_region : var.network_remote_state.region
  }
}

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
