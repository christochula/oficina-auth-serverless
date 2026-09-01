data "aws_iam_policy_document" "assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "this" {
  name               = "${var.function_name}-execution"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "basic" {
  role       = aws_iam_role.this.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "vpc" {
  role       = aws_iam_role.this.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

data "aws_iam_policy_document" "runtime" {
  statement {
    sid       = "WriteXRayTelemetry"
    effect    = "Allow"
    actions   = ["xray:PutTraceSegments", "xray:PutTelemetryRecords"]
    resources = ["*"]
  }

  dynamic "statement" {
    for_each = length(var.secret_arns) > 0 ? [1] : []
    content {
      sid       = "ReadRuntimeSecrets"
      effect    = "Allow"
      actions   = ["secretsmanager:GetSecretValue"]
      resources = var.secret_arns
    }
  }

  dynamic "statement" {
    for_each = length(var.secrets_kms_key_arns) > 0 ? [1] : []
    content {
      sid       = "DecryptRuntimeSecrets"
      effect    = "Allow"
      actions   = ["kms:Decrypt"]
      resources = var.secrets_kms_key_arns
    }
  }
}

resource "aws_iam_role_policy" "runtime" {
  name   = "runtime-least-privilege"
  role   = aws_iam_role.this.id
  policy = data.aws_iam_policy_document.runtime.json
}

resource "aws_iam_role_policy" "additional" {
  count  = var.additional_policy_json == null ? 0 : 1
  name   = "function-specific-permissions"
  role   = aws_iam_role.this.id
  policy = var.additional_policy_json
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/lambda/${var.function_name}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

resource "aws_lambda_function" "this" {
  function_name = var.function_name
  description   = var.description
  role          = aws_iam_role.this.arn
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

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = var.security_group_ids
  }

  tracing_config {
    mode = "Active"
  }

  depends_on = [
    aws_cloudwatch_log_group.this,
    aws_iam_role_policy_attachment.basic,
    aws_iam_role_policy_attachment.vpc,
    aws_iam_role_policy.runtime,
    aws_iam_role_policy.additional,
  ]

  tags = var.tags
}
