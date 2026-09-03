variable "function_name" {
  type = string
}

variable "description" {
  type = string
}

variable "role_arn" {
  description = "ARN da IAM role de execucao (AWS Academy: LabRole)."
  type        = string
}

variable "filename" {
  type = string
}

variable "source_code_hash" {
  type = string
}

variable "original_handler" {
  type = string
}

variable "memory_size" {
  type    = number
  default = 256
}

variable "timeout" {
  type    = number
  default = 10
}

variable "reserved_concurrent_executions" {
  type    = number
  default = -1
}

variable "subnet_ids" {
  type    = list(string)
  default = []
}

variable "security_group_ids" {
  type    = list(string)
  default = []
}

variable "environment_variables" {
  type    = map(string)
  default = {}
}

variable "layers" {
  type    = list(string)
  default = []
}

variable "datadog_enabled" {
  type    = bool
  default = false
}

variable "log_retention_days" {
  type    = number
  default = 14
}

variable "tags" {
  type    = map(string)
  default = {}
}
