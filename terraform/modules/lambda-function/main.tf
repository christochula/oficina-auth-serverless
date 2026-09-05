# AWS Academy: nao cria IAM role (iam:CreateRole bloqueado). Todas as Lambdas
# usam a LabRole pre-existente, passada em var.role_arn.

resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/lambda/${var.function_name}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

resource "aws_lambda_function" "this" {
  function_name = var.function_name
  description   = var.description
  role          = var.role_arn
  runtime       = "nodejs22.x"
  architectures = ["x86_64"]
  handler       = var.datadog_enabled ? "/opt/nodejs/node_modules/datadog-lambda-js/handler.handler" : var.original_handler

  filename         = var.filename
  source_code_hash = var.source_code_hash
  memory_size      = var.memory_size
  timeout          = var.timeout

  reserved_concurrent_executions = var.reserved_concurrent_executions
  layers                         = var.layers

  environment {
    variables = merge(var.environment_variables, {
      DD_LAMBDA_HANDLER = var.original_handler
      NODE_OPTIONS      = "--enable-source-maps"
    })
  }

  dynamic "vpc_config" {
    for_each = length(var.subnet_ids) > 0 ? [1] : []
    content {
      subnet_ids         = var.subnet_ids
      security_group_ids = var.security_group_ids
    }
  }

  tracing_config {
    mode = "Active"
  }

  depends_on = [aws_cloudwatch_log_group.this]

  tags = var.tags
}
