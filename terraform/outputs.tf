output "api_id" {
  description = "ID do HTTP API."
  value       = module.http_api.api_id
}

output "api_endpoint" {
  description = "Endpoint base do HTTP API."
  value       = module.http_api.api_endpoint
}

output "auth_token_endpoint" {
  description = "Endpoint de autenticacao por CPF."
  value       = "${module.http_api.api_endpoint}/auth/token"
}

output "protected_proxy_route" {
  description = "Rota protegida encaminhada para o backend."
  value       = "${module.http_api.api_endpoint}/api/{proxy+}"
}

output "auth_function_name" {
  value = module.auth_function.function_name
}

output "authorizer_function_name" {
  value = module.authorizer_function.function_name
}

output "jwt_secret_arn" {
  description = "ARN do secret JWT compartilhado (input, repassado como contrato)."
  value       = var.jwt_secret_arn
}

output "client_lookup_endpoint" {
  description = "HTTPS endpoint called by auth; OS validates the internal token."
  value       = var.os_client_lookup_url != "" ? var.os_client_lookup_url : "${module.http_api.api_endpoint}/api/v1/internal/auth/cliente"
}

output "notification_queue_url" {
  value = try(module.notification_messaging[0].queue_url, null)
}

output "notification_queue_arn" {
  value = try(module.notification_messaging[0].queue_arn, null)
}

output "notification_topic_arn" {
  value = try(module.notification_messaging[0].topic_arn, null)
}
