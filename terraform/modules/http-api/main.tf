resource "aws_apigatewayv2_api" "this" {
  name          = var.name
  protocol_type = "HTTP"
  description   = "CPF authentication and protected proxy for Oficina API"

  cors_configuration {
    allow_credentials = false
    allow_headers = [
      "authorization",
      "content-type",
      "traceparent",
      "tracestate",
      "x-correlation-id",
      "x-webhook-token",
    ]
    allow_methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    allow_origins = var.cors_allowed_origins
    expose_headers = [
      "x-correlation-id",
    ]
    max_age = 300
  }

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "access" {
  name              = "/aws/apigateway/${var.name}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

resource "aws_apigatewayv2_vpc_link" "this" {
  name               = "${var.name}-vpc-link"
  subnet_ids         = var.vpc_link_subnet_ids
  security_group_ids = var.vpc_link_security_group_ids
  tags               = var.tags
}

resource "aws_apigatewayv2_integration" "auth" {
  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.auth_function_invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 10000
}

resource "aws_apigatewayv2_route" "auth" {
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = "POST /auth/token"
  target             = "integrations/${aws_apigatewayv2_integration.auth.id}"
  authorization_type = "NONE"
}

resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id                            = aws_apigatewayv2_api.this.id
  name                              = "${var.name}-jwt-authorizer"
  authorizer_type                   = "REQUEST"
  authorizer_uri                    = var.authorizer_function_invoke_arn
  authorizer_payload_format_version = "2.0"
  enable_simple_responses           = true
  authorizer_result_ttl_in_seconds  = var.authorizer_cache_ttl_seconds
  identity_sources                  = ["$request.header.Authorization"]
}

resource "aws_apigatewayv2_integration" "private_api" {
  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "HTTP_PROXY"
  integration_method     = "ANY"
  integration_uri        = var.backend_listener_arn
  connection_type        = "VPC_LINK"
  connection_id          = aws_apigatewayv2_vpc_link.this.id
  payload_format_version = "1.0"
  timeout_milliseconds   = 30000

  request_parameters = {
    "overwrite:path"                    = "$request.path"
    "overwrite:header.x-auth-sub"       = "$context.authorizer.sub"
    "overwrite:header.x-auth-client-id" = "$context.authorizer.client_id"
    "overwrite:header.x-auth-role"      = "$context.authorizer.role"
    "overwrite:header.x-auth-scopes"    = "$context.authorizer.scopes"
    "overwrite:header.x-token-use"      = "$context.authorizer.token_use"
  }

  dynamic "tls_config" {
    for_each = try(length(trimspace(var.private_integration_tls_server_name)) > 0, false) ? [1] : []
    content {
      server_name_to_verify = var.private_integration_tls_server_name
    }
  }
}

resource "aws_apigatewayv2_route" "private_api" {
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = "ANY /api/{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.private_api.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# Probes, documentação e o bootstrap/refresh do login de operadores não
# carregam autorização do authorizer de access tokens. Cada endpoint ainda
# aplica a validação apropriada no NestJS. Rotas específicas têm precedência
# sobre o proxy protegido.
resource "aws_apigatewayv2_route" "public_backend" {
  for_each = toset([
    "GET /api/health/live",
    "GET /api/health/ready",
    "GET /api/docs",
    "GET /api/docs/{proxy+}",
    "GET /api/docs-json",
    "GET /api/docs-yaml",
    "POST /api/v1/auth/login",
    "POST /api/v1/auth/refresh",
  ])

  api_id             = aws_apigatewayv2_api.this.id
  route_key          = each.value
  target             = "integrations/${aws_apigatewayv2_integration.private_api.id}"
  authorization_type = "NONE"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    detailed_metrics_enabled = true
    throttling_burst_limit   = var.throttling_burst_limit
    throttling_rate_limit    = var.throttling_rate_limit
  }

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.access.arn
    format = jsonencode({
      request_id          = "$context.requestId"
      extended_request_id = "$context.extendedRequestId"
      route_key           = "$context.routeKey"
      status              = "$context.status"
      response_latency_ms = "$context.responseLatency"
      integration_error   = "$context.integrationErrorMessage"
      source_ip           = "$context.identity.sourceIp"
      user_agent          = "$context.identity.userAgent"
    })
  }

  tags = var.tags
}

resource "aws_lambda_permission" "auth" {
  statement_id  = "AllowHttpApiAuthRoute"
  action        = "lambda:InvokeFunction"
  function_name = var.auth_function_arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.this.execution_arn}/*/POST/auth/token"
}

resource "aws_lambda_permission" "authorizer" {
  statement_id  = "AllowHttpApiAuthorizer"
  action        = "lambda:InvokeFunction"
  function_name = var.authorizer_function_arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.this.execution_arn}/authorizers/${aws_apigatewayv2_authorizer.jwt.id}"
}
