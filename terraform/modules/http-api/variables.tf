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

variable "backend_url" {
  description = "URL publica do LoadBalancer do EKS (oficina-api). Ex: http://<elb-dns>"
  type        = string
}

variable "cors_allowed_origins" {
  type    = list(string)
  default = ["*"]
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
  default = 14
}

variable "tags" {
  type    = map(string)
  default = {}
}
