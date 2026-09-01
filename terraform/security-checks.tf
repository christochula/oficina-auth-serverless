check "production_private_integration_uses_tls" {
  assert {
    condition = (
      var.environment != "production" ||
      var.private_integration_tls_server_name != null
    )
    error_message = "production requires private_integration_tls_server_name matching the internal ALB certificate."
  }
}
