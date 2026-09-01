variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Prefix used for resource names and tags."
  type        = string
  default     = "oficina-auth"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,19}$", var.project_name))
    error_message = "project_name must be a lowercase, DNS-safe name with 3-20 characters."
  }
}

variable "environment" {
  description = "Deployment environment. The homolog branch uses homolog and main uses production."
  type        = string

  validation {
    condition     = contains(["homolog", "production"], var.environment)
    error_message = "environment must be homolog or production."
  }
}

variable "owner" {
  description = "Owner tag."
  type        = string
  default     = "soat-architecture"
}

variable "release_version" {
  description = "Application version used by Datadog unified service tagging."
  type        = string
  default     = "1.0.0"
}

variable "extra_tags" {
  description = "Additional tags applied to every AWS resource."
  type        = map(string)
  default     = {}
}

variable "db_secret_arn" {
  description = "ARN of an existing Secrets Manager secret containing PostgreSQL connection data."
  type        = string

  validation {
    condition     = can(regex("^arn:[^:]+:secretsmanager:", var.db_secret_arn))
    error_message = "db_secret_arn must be a Secrets Manager ARN."
  }
}

variable "jwt_secret_arn" {
  description = "ARN of the shared JWT secret containing secret and refreshSecret."
  type        = string

  validation {
    condition     = can(regex("^arn:[^:]+:secretsmanager:", var.jwt_secret_arn))
    error_message = "jwt_secret_arn must be a Secrets Manager ARN."
  }
}

variable "secrets_kms_key_arns" {
  description = "Optional customer-managed KMS keys used by the supplied secrets."
  type        = list(string)
  default     = []
}

variable "jwt_issuer" {
  description = "Expected iss claim shared with oficina-api."
  type        = string
  default     = "oficina-auth-serverless"
}

variable "jwt_audience" {
  description = "Expected aud claim shared with oficina-api."
  type        = string
  default     = "oficina-api"
}

variable "cors_allowed_origins" {
  description = "Explicit browser origins allowed by the HTTP API. Do not use a wildcard in production."
  type        = list(string)

  validation {
    condition     = length(var.cors_allowed_origins) > 0 && alltrue([for origin in var.cors_allowed_origins : can(regex("^https?://", origin))])
    error_message = "cors_allowed_origins must contain at least one explicit http(s) origin."
  }
}

variable "jwt_ttl_seconds" {
  description = "Short access-token lifetime in seconds."
  type        = number
  default     = 300

  validation {
    condition     = var.jwt_ttl_seconds >= 60 && var.jwt_ttl_seconds <= 900
    error_message = "jwt_ttl_seconds must be between 60 and 900 seconds."
  }
}

variable "jwt_default_role" {
  description = "Role claim emitted for clients authenticated by CPF."
  type        = string
  default     = "CLIENTE"
}

variable "jwt_default_scopes" {
  description = "Scopes emitted for client tokens."
  type        = list(string)
  default     = ["orders:read", "orders:write"]
}

variable "lambda_subnet_ids" {
  description = "Existing private subnet IDs for Lambda. If empty, remote-state outputs are used."
  type        = list(string)
  default     = []
}

variable "lambda_security_group_ids" {
  description = "Existing security group IDs for Lambda. If empty, remote-state outputs are used."
  type        = list(string)
  default     = []
}

variable "vpc_link_subnet_ids" {
  description = "Existing private subnet IDs for API Gateway VPC Link; defaults to Lambda subnets."
  type        = list(string)
  default     = []
}

variable "vpc_link_security_group_ids" {
  description = "Existing security groups for API Gateway VPC Link; defaults to Lambda security groups."
  type        = list(string)
  default     = []
}

variable "backend_listener_arn" {
  description = "Existing ALB listener ARN for the private oficina-api integration."
  type        = string
  default     = null
  nullable    = true
}

variable "private_integration_tls_server_name" {
  description = "Optional TLS server name when the supplied ALB listener uses HTTPS."
  type        = string
  default     = null
  nullable    = true
  validation {
    condition     = var.environment != "production" || try(length(trimspace(var.private_integration_tls_server_name)) > 0, false)
    error_message = "production requires private_integration_tls_server_name matching the internal ALB certificate."
  }
}

variable "network_remote_state" {
  description = "Optional S3 remote state for subnet, security group and backend listener outputs."
  type = object({
    bucket = string
    key    = string
    region = string
  })
  default  = null
  nullable = true
}

variable "api_throttling_burst_limit" {
  description = "Default API Gateway burst limit."
  type        = number
  default     = 100
}

variable "api_throttling_rate_limit" {
  description = "Default API Gateway steady-state requests per second."
  type        = number
  default     = 50
}

variable "authorizer_cache_ttl_seconds" {
  description = "Authorizer cache TTL. Zero avoids route-wide authorization cache surprises."
  type        = number
  default     = 0

  validation {
    condition     = var.authorizer_cache_ttl_seconds >= 0 && var.authorizer_cache_ttl_seconds <= 300
    error_message = "authorizer_cache_ttl_seconds must be between 0 and 300."
  }
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention."
  type        = number
  default     = 30
}

variable "datadog_enabled" {
  description = "Attach official Datadog Node and Extension layers and enable the wrapper."
  type        = bool
  default     = true
}

variable "datadog_api_key_secret_arn" {
  description = "Secrets Manager ARN consumed directly by the Datadog Extension."
  type        = string
  default     = null
  nullable    = true
}

variable "datadog_site" {
  description = "Datadog site, for example datadoghq.com or datadoghq.eu."
  type        = string
  default     = "datadoghq.com"
}

variable "datadog_node_layer_version" {
  description = "Pinned official Datadog Node22-x layer version."
  type        = number
  default     = 142
}

variable "datadog_extension_layer_version" {
  description = "Pinned official Datadog Extension x86 layer version."
  type        = number
  default     = 99
}

variable "notification_enabled" {
  description = "Provision the optional SQS to Lambda to SNS notification flow."
  type        = bool
  default     = true
}

variable "notification_max_receive_count" {
  description = "SQS receive attempts before moving a notification to the DLQ."
  type        = number
  default     = 3
}
