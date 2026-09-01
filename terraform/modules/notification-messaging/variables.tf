variable "name" {
  type = string
}

variable "max_receive_count" {
  type    = number
  default = 3
}

variable "tags" {
  type    = map(string)
  default = {}
}
