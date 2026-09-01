module "auth_function" {
  source = "./modules/lambda-function"

  function_name    = "${local.name_prefix}-token"
  description      = "Validates CPF, checks the active customer and issues a short client JWT"
  filename         = data.archive_file.auth.output_path
  source_code_hash = data.archive_file.auth.output_base64sha256
  original_handler = "handler.handler"
  memory_size      = 256
  timeout          = 10

  subnet_ids           = local.lambda_subnet_ids
  security_group_ids   = local.lambda_security_group_ids
  secret_arns          = local.auth_secret_arns
  secrets_kms_key_arns = var.secrets_kms_key_arns
  layers               = local.datadog_layers
  datadog_enabled      = var.datadog_enabled
  log_retention_days   = var.log_retention_days

  environment_variables = merge(
    local.datadog_environment,
    local.datadog_secret_environment,
    {
      DD_SERVICE               = "oficina-auth-token"
      DB_SECRET_ARN            = var.db_secret_arn
      JWT_SECRET_ARN           = var.jwt_secret_arn
      JWT_ISSUER               = var.jwt_issuer
      JWT_AUDIENCE             = var.jwt_audience
      JWT_TTL_SECONDS          = tostring(var.jwt_ttl_seconds)
      JWT_DEFAULT_ROLE         = var.jwt_default_role
      JWT_DEFAULT_SCOPES       = join(",", var.jwt_default_scopes)
      SECRET_CACHE_TTL_MS      = "300000"
      PG_POOL_MAX              = "4"
      PG_CONNECTION_TIMEOUT_MS = "3000"
      NODE_EXTRA_CA_CERTS      = "/var/runtime/ca-cert.pem"
      LOG_LEVEL                = "info"
    }
  )

  tags = local.tags
}

module "authorizer_function" {
  source = "./modules/lambda-function"

  function_name    = "${local.name_prefix}-authorizer"
  description      = "Validates short client JWTs for protected HTTP API routes"
  filename         = data.archive_file.authorizer.output_path
  source_code_hash = data.archive_file.authorizer.output_base64sha256
  original_handler = "authorizer.handler"
  memory_size      = 256
  timeout          = 5

  subnet_ids           = local.lambda_subnet_ids
  security_group_ids   = local.lambda_security_group_ids
  secret_arns          = local.authorizer_secret_arns
  secrets_kms_key_arns = var.secrets_kms_key_arns
  layers               = local.datadog_layers
  datadog_enabled      = var.datadog_enabled
  log_retention_days   = var.log_retention_days

  environment_variables = merge(
    local.datadog_environment,
    local.datadog_secret_environment,
    {
      DD_SERVICE          = "oficina-auth-authorizer"
      JWT_SECRET_ARN      = var.jwt_secret_arn
      JWT_ISSUER          = var.jwt_issuer
      JWT_AUDIENCE        = var.jwt_audience
      SECRET_CACHE_TTL_MS = "300000"
      LOG_LEVEL           = "info"
    }
  )

  tags = local.tags
}

module "http_api" {
  source = "./modules/http-api"

  name                           = local.name_prefix
  auth_function_arn              = module.auth_function.function_arn
  auth_function_invoke_arn       = module.auth_function.invoke_arn
  authorizer_function_arn        = module.authorizer_function.function_arn
  authorizer_function_invoke_arn = module.authorizer_function.invoke_arn

  backend_listener_arn                = local.backend_listener_arn
  vpc_link_subnet_ids                 = local.vpc_link_subnet_ids
  vpc_link_security_group_ids         = local.vpc_link_security_group_ids
  private_integration_tls_server_name = var.private_integration_tls_server_name
  cors_allowed_origins                = var.cors_allowed_origins

  authorizer_cache_ttl_seconds = var.authorizer_cache_ttl_seconds
  throttling_burst_limit       = var.api_throttling_burst_limit
  throttling_rate_limit        = var.api_throttling_rate_limit
  log_retention_days           = var.log_retention_days
  tags                         = local.tags
}

module "notification_messaging" {
  count  = var.notification_enabled ? 1 : 0
  source = "./modules/notification-messaging"

  name              = "${local.name_prefix}-notifications"
  max_receive_count = var.notification_max_receive_count
  tags              = local.tags
}

data "aws_iam_policy_document" "notification" {
  count = var.notification_enabled ? 1 : 0

  statement {
    sid    = "ConsumeNotificationQueue"
    effect = "Allow"
    actions = [
      "sqs:ChangeMessageVisibility",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
      "sqs:ReceiveMessage"
    ]
    resources = [module.notification_messaging[0].queue_arn]
  }

  statement {
    sid       = "PublishNotificationTopic"
    effect    = "Allow"
    actions   = ["sns:Publish"]
    resources = [module.notification_messaging[0].topic_arn]
  }
}

module "notification_function" {
  count  = var.notification_enabled ? 1 : 0
  source = "./modules/lambda-function"

  function_name    = "${local.name_prefix}-notification"
  description      = "Publishes validated SQS notification requests to SNS"
  filename         = data.archive_file.notification[0].output_path
  source_code_hash = data.archive_file.notification[0].output_base64sha256
  original_handler = "notification.handler"
  memory_size      = 256
  timeout          = 15

  subnet_ids             = local.lambda_subnet_ids
  security_group_ids     = local.lambda_security_group_ids
  secret_arns            = local.notification_secret_arns
  secrets_kms_key_arns   = var.secrets_kms_key_arns
  additional_policy_json = data.aws_iam_policy_document.notification[0].json
  layers                 = local.datadog_layers
  datadog_enabled        = var.datadog_enabled
  log_retention_days     = var.log_retention_days

  environment_variables = merge(
    local.datadog_environment,
    local.datadog_secret_environment,
    {
      DD_SERVICE             = "oficina-notification"
      NOTIFICATION_TOPIC_ARN = module.notification_messaging[0].topic_arn
      LOG_LEVEL              = "info"
    }
  )

  tags = local.tags
}

resource "aws_lambda_event_source_mapping" "notification" {
  count = var.notification_enabled ? 1 : 0

  event_source_arn = module.notification_messaging[0].queue_arn
  function_name    = module.notification_function[0].function_arn
  batch_size       = 10
  enabled          = true

  function_response_types = ["ReportBatchItemFailures"]

  scaling_config {
    maximum_concurrency = 5
  }
}
