locals {
  name_prefix = "${var.project_name}-${var.environment}"

  lab_role_arn = var.lab_role_arn != "" ? var.lab_role_arn : "arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:role/LabRole"

  datadog_account_id = "464622532012"
  datadog_layers = var.datadog_enabled ? [
    "arn:${data.aws_partition.current.partition}:lambda:${data.aws_region.current.region}:${local.datadog_account_id}:layer:Datadog-Node22-x:${var.datadog_node_layer_version}",
    "arn:${data.aws_partition.current.partition}:lambda:${data.aws_region.current.region}:${local.datadog_account_id}:layer:Datadog-Extension:${var.datadog_extension_layer_version}"
  ] : []

  datadog_environment = merge(
    {
      DD_ENV           = var.environment
      DD_VERSION       = var.release_version
      DD_TRACE_ENABLED = tostring(var.datadog_enabled)
    },
    var.datadog_enabled ? {
      DD_SITE                    = var.datadog_site
      DD_LOGS_INJECTION          = "true"
      DD_CAPTURE_LAMBDA_PAYLOAD  = "false"
      DD_SERVERLESS_LOGS_ENABLED = "true"
      DD_API_KEY_SECRET_ARN      = var.datadog_api_key_secret_arn
    } : {}
  )

  tags = merge({
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
    Repository  = "oficina-auth-serverless"
    Owner       = var.owner
  }, var.extra_tags)
}
