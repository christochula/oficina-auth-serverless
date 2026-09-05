resource "aws_apigatewayv2_api" "this" {
  name          = var.name
  protocol_type = "HTTP"
  description   = "Autenticacao por CPF e proxy protegido da Oficina API"

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
    allow_methods  = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    allow_origins  = var.cors_allowed_origins
    expose_headers = ["x-correlation-id"]
    max_age        = 300
  }

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "access" {
  name              = "/aws/apigateway/${var.name}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
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

# AWS Academy: sem VPC Link nem ALB interno. O EKS expoe a aplicacao por um
# Service type LoadBalancer publico; o API Gateway faz HTTP_PROXY direto para
# essa URL (var.backend_url).
resource "aws_apigatewayv2_integration" "private_api" {
  api_id             = aws_apigatewayv2_api.this.id
  integration_type   = "HTTP_PROXY"
  integration_method = "ANY"
  # Route ANY /api/{proxy+} captura tudo depois de /api/. O NestJS usa prefixo
  # global /api, entao reconstruimos: http://<elb>/api/{proxy}.
  integration_uri        = "${trimsuffix(var.backend_url, "/")}/api/{proxy}"
  connection_type        = "INTERNET"
  payload_format_version = "1.0"
  timeout_milliseconds   = 30000

  request_parameters = {
    "overwrite:header.x-auth-sub"       = "$context.authorizer.sub"
    "overwrite:header.x-auth-client-id" = "$context.authorizer.client_id"
    "overwrite:header.x-auth-role"      = "$context.authorizer.role"
    "overwrite:header.x-auth-scopes"    = "$context.authorizer.scopes"
    "overwrite:header.x-token-use"      = "$context.authorizer.token_use"
  }
}

resource "aws_apigatewayv2_route" "private_api" {
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = "ANY /api/{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.private_api.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# Uma unica rota ANY /api/{proxy+} com o authorizer. Os endpoints publicos do
# NestJS (health, docs, login/refresh de operador) sao liberados pelo proprio
# authorizer (allowlist de path), evitando rotas estaticas com {proxy} na URI
# (que o API Gateway rejeita).

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
      route_key           = "$context.routeKey"
      status              = "$context.status"
      response_latency_ms = "$context.responseLatency"
      integration_error   = "$context.integrationErrorMessage"
      source_ip           = "$context.identity.sourceIp"
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
