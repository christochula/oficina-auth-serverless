output "api_id" {
  description = "HTTP API identifier."
  value       = module.http_api.api_id
}

output "api_endpoint" {
  description = "Base endpoint for the deployed HTTP API."
  value       = module.http_api.api_endpoint
}

output "auth_token_endpoint" {
  description = "CPF authentication endpoint."
  value       = "${module.http_api.api_endpoint}/auth/token"
}

output "protected_proxy_route" {
  description = "Protected route pattern forwarded through VPC Link."
  value       = "${module.http_api.api_endpoint}/api/{proxy+}"
}

output "auth_function_name" {
  value = module.auth_function.function_name
}

output "authorizer_function_name" {
  value = module.authorizer_function.function_name
}

output "jwt_secret_arn" {
  description = "Shared JWT secret ARN consumed by the serverless and application repositories."
  value       = data.aws_secretsmanager_secret.jwt.arn
}

output "jwt_secret_name" {
  description = "Shared JWT secret name consumed by the serverless and application repositories."
  value       = data.aws_secretsmanager_secret.jwt.name
}

output "database_secret_arn" {
  value = data.aws_secretsmanager_secret.database.arn
}

output "database_secret_name" {
  value = data.aws_secretsmanager_secret.database.name
}

output "notification_queue_url" {
  value = try(module.notification_messaging[0].queue_url, null)
}

output "notification_queue_arn" {
  value = try(module.notification_messaging[0].queue_arn, null)
}

output "notification_dlq_url" {
  value = try(module.notification_messaging[0].dlq_url, null)
}

output "notification_topic_arn" {
  value = try(module.notification_messaging[0].topic_arn, null)
}

output "datadog_layer_versions" {
  value = var.datadog_enabled ? {
    node      = var.datadog_node_layer_version
    extension = var.datadog_extension_layer_version
  } : null
}
