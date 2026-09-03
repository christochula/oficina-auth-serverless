# AWS Academy: Lambdas usam a LabRole; sem VPC (RDS publico com TLS forcado);
# sem policies por funcao (LabRole ja cobre Secrets Manager, SQS, SNS, X-Ray).

module "auth_function" {
  source = "./modules/lambda-function"

  function_name    = "${local.name_prefix}-token"
  description      = "Valida CPF, confere cliente ativo e emite JWT curto de cliente"
  role_arn         = local.lab_role_arn
  filename         = data.archive_file.auth.output_path
  source_code_hash = data.archive_file.auth.output_base64sha256
  original_handler = "handler.handler"
  memory_size      = 256
  timeout          = 15

  layers          = local.datadog_layers
  datadog_enabled = var.datadog_enabled

  environment_variables = merge(local.datadog_environment, {
    DD_SERVICE               = "oficina-auth-token"
    DB_SECRET_ARN            = var.db_secret_arn
    JWT_SECRET_ARN           = var.jwt_secret_arn
    JWT_ISSUER               = var.jwt_issuer
    JWT_AUDIENCE             = var.jwt_audience
    JWT_TTL_SECONDS          = tostring(var.jwt_ttl_seconds)
    JWT_DEFAULT_ROLE         = "CLIENTE"
    JWT_DEFAULT_SCOPES       = join(",", var.jwt_default_scopes)
    SECRET_CACHE_TTL_MS      = "300000"
    PG_POOL_MAX              = "2"
    PG_CONNECTION_TIMEOUT_MS = "5000"
    NODE_EXTRA_CA_CERTS      = "/var/runtime/ca-cert.pem"
    LOG_LEVEL                = "info"
  })

  tags = local.tags
}

module "authorizer_function" {
  source = "./modules/lambda-function"

  function_name    = "${local.name_prefix}-authorizer"
  description      = "Valida JWT de cliente/operador para as rotas protegidas"
  role_arn         = local.lab_role_arn
  filename         = data.archive_file.authorizer.output_path
  source_code_hash = data.archive_file.authorizer.output_base64sha256
  original_handler = "authorizer.handler"
  memory_size      = 256
  timeout          = 10

  layers          = local.datadog_layers
  datadog_enabled = var.datadog_enabled

  environment_variables = merge(local.datadog_environment, {
    DD_SERVICE          = "oficina-auth-authorizer"
    JWT_SECRET_ARN      = var.jwt_secret_arn
    JWT_ISSUER          = var.jwt_issuer
    JWT_AUDIENCE        = var.jwt_audience
    SECRET_CACHE_TTL_MS = "300000"
    LOG_LEVEL           = "info"
  })

  tags = local.tags
}

module "http_api" {
  source = "./modules/http-api"

  name                           = local.name_prefix
  auth_function_arn              = module.auth_function.function_arn
  auth_function_invoke_arn       = module.auth_function.invoke_arn
  authorizer_function_arn        = module.authorizer_function.function_arn
  authorizer_function_invoke_arn = module.authorizer_function.invoke_arn

  backend_url          = var.backend_url
  cors_allowed_origins = var.cors_allowed_origins

  authorizer_cache_ttl_seconds = 0
  tags                         = local.tags
}

module "notification_messaging" {
  count  = var.notification_enabled ? 1 : 0
  source = "./modules/notification-messaging"

  name              = "${local.name_prefix}-notifications"
  max_receive_count = 3
  tags              = local.tags
}

module "notification_function" {
  count  = var.notification_enabled ? 1 : 0
  source = "./modules/lambda-function"

  function_name    = "${local.name_prefix}-notification"
  description      = "Publica no SNS as notificacoes validadas recebidas da SQS"
  role_arn         = local.lab_role_arn
  filename         = data.archive_file.notification[0].output_path
  source_code_hash = data.archive_file.notification[0].output_base64sha256
  original_handler = "notification.handler"
  memory_size      = 256
  timeout          = 15

  layers          = local.datadog_layers
  datadog_enabled = var.datadog_enabled

  environment_variables = merge(local.datadog_environment, {
    DD_SERVICE             = "oficina-notification"
    NOTIFICATION_TOPIC_ARN = module.notification_messaging[0].topic_arn
    LOG_LEVEL              = "info"
  })

  tags = local.tags
}

resource "aws_lambda_event_source_mapping" "notification" {
  count = var.notification_enabled ? 1 : 0

  event_source_arn = module.notification_messaging[0].queue_arn
  function_name    = module.notification_function[0].function_arn
  batch_size       = 10
  enabled          = true

  function_response_types = ["ReportBatchItemFailures"]
}
