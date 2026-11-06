variable "aws_region" {
  description = "Regiao AWS."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Prefixo para nomes de recursos e tags."
  type        = string
  default     = "oficina-auth"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,19}$", var.project_name))
    error_message = "project_name deve ser DNS-safe, minusculo, 3-20 caracteres."
  }
}

variable "environment" {
  description = "Ambiente."
  type        = string
  default     = "homolog"
}

variable "owner" {
  description = "Tag Owner."
  type        = string
  default     = "soat-architecture"
}

variable "release_version" {
  description = "Versao (unified service tagging)."
  type        = string
  default     = "1.0.0"
}

variable "extra_tags" {
  description = "Tags adicionais."
  type        = map(string)
  default     = {}
}

# --- AWS Academy ------------------------------------------------------------
variable "lab_role_arn" {
  description = "ARN da LabRole usada como execution role de todas as Lambdas. Vazio = deriva de account_id."
  type        = string
  default     = ""
}

# --- Contratos com os outros repos (passados como TF_VAR no deploy) ---------
variable "os_client_lookup_url" {
  description = "Optional HTTPS lookup URL; empty derives this Gateway's exact internal route."
  type        = string
  default     = ""
  validation {
    condition     = var.os_client_lookup_url == "" || can(regex("^https://", var.os_client_lookup_url))
    error_message = "os_client_lookup_url must use HTTPS."
  }
}

variable "auth_client_lookup_secret_arn" {
  description = "Secrets Manager ARN, JSON token (at least 32 bytes), shared only with OS."
  type        = string
  validation {
    condition     = can(regex("^arn:aws[a-z-]*:secretsmanager:[a-z0-9-]+:[0-9]{12}:secret:", var.auth_client_lookup_secret_arn))
    error_message = "auth_client_lookup_secret_arn must be an AWS Secrets Manager ARN."
  }
}

variable "billing_backend_url" {
  description = "Billing public LoadBalancer base URL."
  type        = string
  validation {
    condition     = can(regex("^https?://[^/?#@]+/?$", var.billing_backend_url))
    error_message = "billing_backend_url must be an HTTP(S) base URL without credentials, path or query."
  }
}

variable "production_backend_url" {
  description = "Production public LoadBalancer base URL."
  type        = string
  validation {
    condition     = can(regex("^https?://[^/?#@]+/?$", var.production_backend_url))
    error_message = "production_backend_url must be an HTTP(S) base URL without credentials, path or query."
  }
}

variable "jwt_secret_arn" {
  description = "ARN do secret JWT compartilhado (JSON com secret e refreshSecret)."
  type        = string
  validation {
    condition     = can(regex("^arn:aws[a-z-]*:secretsmanager:[a-z0-9-]+:[0-9]{12}:secret:", var.jwt_secret_arn))
    error_message = "jwt_secret_arn must be an AWS Secrets Manager ARN."
  }
}

variable "backend_url" {
  description = "URL publica do LoadBalancer do EKS (oficina-api). Placeholder ate o repo de app subir."
  type        = string
  validation {
    condition     = can(regex("^https?://[^/?#@]+/?$", var.backend_url))
    error_message = "backend_url must be an HTTP(S) base URL without credentials, path or query."
  }
}

variable "jwt_issuer" {
  description = "Claim iss compartilhado com oficina-api."
  type        = string
  default     = "oficina-auth-serverless"
}

variable "jwt_audience" {
  description = "Claim aud compartilhado com oficina-api."
  type        = string
  default     = "oficina-api"
}

variable "cors_allowed_origins" {
  description = "Origens permitidas pelo HTTP API."
  type        = list(string)
  default     = ["*"]
}

variable "jwt_ttl_seconds" {
  description = "Validade do access token de cliente (segundos)."
  type        = number
  default     = 300
}

variable "jwt_default_scopes" {
  description = "Scopes emitidos para tokens de cliente."
  type        = list(string)
  default     = ["orders:read", "orders:write"]
}

# --- Datadog (opcional; layers exigem a API key da Extension) --------------
variable "datadog_enabled" {
  description = "Anexa as layers Datadog e o wrapper."
  type        = bool
  default     = false
}

variable "datadog_api_key_secret_arn" {
  description = "ARN do secret consumido pela Datadog Lambda Extension."
  type        = string
  default     = null
  nullable    = true
}

variable "datadog_site" {
  description = "Site Datadog."
  type        = string
  default     = "datadoghq.com"
}

variable "datadog_node_layer_version" {
  type    = number
  default = 142
}

variable "datadog_extension_layer_version" {
  type    = number
  default = 99
}

variable "notification_enabled" {
  description = "Provisiona o fluxo SQS -> Lambda -> SNS de notificacoes."
  type        = bool
  default     = true
}
