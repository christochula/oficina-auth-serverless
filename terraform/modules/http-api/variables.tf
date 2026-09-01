variable "name" {
  type = string
}

variable "auth_function_arn" {
  type = string
}

variable "auth_function_invoke_arn" {
  type = string
}

variable "authorizer_function_arn" {
  type = string
}

variable "authorizer_function_invoke_arn" {
  type = string
}

variable "backend_listener_arn" {
  type = string
}

variable "vpc_link_subnet_ids" {
  type = list(string)
}

variable "vpc_link_security_group_ids" {
  type = list(string)
}

variable "private_integration_tls_server_name" {
  type     = string
  default  = null
  nullable = true
}

variable "cors_allowed_origins" {
  type = list(string)
}

variable "authorizer_cache_ttl_seconds" {
  type    = number
  default = 0
}

variable "throttling_burst_limit" {
  type    = number
  default = 100
}

variable "throttling_rate_limit" {
  type    = number
  default = 50
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "tags" {
  type    = map(string)
  default = {}
}
