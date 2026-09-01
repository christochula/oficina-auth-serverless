locals {
  name_prefix = "${var.project_name}-${var.environment}"

  remote_network_outputs = var.network_remote_state == null ? {} : data.terraform_remote_state.network[0].outputs

  lambda_subnet_ids = length(var.lambda_subnet_ids) > 0 ? var.lambda_subnet_ids : try(
    tolist(local.remote_network_outputs.lambda_subnet_ids),
    tolist(local.remote_network_outputs.private_subnet_ids),
    []
  )
  lambda_security_group_ids = length(var.lambda_security_group_ids) > 0 ? var.lambda_security_group_ids : try(
    tolist(local.remote_network_outputs.lambda_security_group_ids),
    []
  )
  vpc_link_subnet_ids = length(var.vpc_link_subnet_ids) > 0 ? var.vpc_link_subnet_ids : try(
    tolist(local.remote_network_outputs.vpc_link_subnet_ids),
    local.lambda_subnet_ids
  )
  vpc_link_security_group_ids = length(var.vpc_link_security_group_ids) > 0 ? var.vpc_link_security_group_ids : try(
    tolist(local.remote_network_outputs.vpc_link_security_group_ids),
    local.lambda_security_group_ids
  )
  backend_listener_arn = var.backend_listener_arn != null ? var.backend_listener_arn : try(
    local.remote_network_outputs.backend_listener_arn,
    local.remote_network_outputs.alb_listener_arn,
    null
  )

  datadog_account_id = data.aws_partition.current.partition == "aws-us-gov" ? "002406178527" : "464622532012"
  datadog_layers = var.datadog_enabled ? [
    "arn:${data.aws_partition.current.partition}:lambda:${data.aws_region.current.region}:${local.datadog_account_id}:layer:Datadog-Node22-x:${var.datadog_node_layer_version}",
    "arn:${data.aws_partition.current.partition}:lambda:${data.aws_region.current.region}:${local.datadog_account_id}:layer:Datadog-Extension:${var.datadog_extension_layer_version}"
  ] : []

  datadog_environment = {
    DD_ENABLED                 = tostring(var.datadog_enabled)
    DD_ENV                     = var.environment
    DD_VERSION                 = var.release_version
    DD_SITE                    = var.datadog_site
    DD_TRACE_ENABLED           = tostring(var.datadog_enabled)
    DD_LOGS_INJECTION          = "true"
    DD_CAPTURE_LAMBDA_PAYLOAD  = "false"
    DD_SERVERLESS_LOGS_ENABLED = "true"
    DD_TRACE_PROPAGATION_STYLE = "tracecontext,Datadog"
  }

  datadog_secret_environment = var.datadog_enabled ? {
    DD_API_KEY_SECRET_ARN = coalesce(var.datadog_api_key_secret_arn, "")
  } : {}

  auth_secret_arns = compact([
    var.db_secret_arn,
    var.jwt_secret_arn,
    var.datadog_enabled ? var.datadog_api_key_secret_arn : null
  ])

  authorizer_secret_arns = compact([
    var.jwt_secret_arn,
    var.datadog_enabled ? var.datadog_api_key_secret_arn : null
  ])

  notification_secret_arns = compact([
    var.datadog_enabled ? var.datadog_api_key_secret_arn : null
  ])

  tags = merge({
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
    Repository  = "oficina-auth-serverless"
    Owner       = var.owner
  }, var.extra_tags)
}

check "supported_datadog_partition" {
  assert {
    condition     = !var.datadog_enabled || contains(["aws", "aws-us-gov"], data.aws_partition.current.partition)
    error_message = "Automatic Datadog layer ARNs support commercial AWS and GovCloud partitions only."
  }
}

check "datadog_secret" {
  assert {
    condition     = !var.datadog_enabled || var.datadog_api_key_secret_arn != null
    error_message = "datadog_api_key_secret_arn is required when datadog_enabled is true."
  }
}

check "lambda_network" {
  assert {
    condition     = length(local.lambda_subnet_ids) >= 2 && length(local.lambda_security_group_ids) > 0
    error_message = "Provide Lambda subnet IDs in at least two AZs and at least one security group, directly or by remote state."
  }
}

check "private_integration" {
  assert {
    condition = (
      local.backend_listener_arn != null &&
      length(local.vpc_link_subnet_ids) >= 2 &&
      length(local.vpc_link_security_group_ids) > 0
    )
    error_message = "The protected proxy requires an ALB listener ARN, two VPC Link subnets and a security group."
  }
}
