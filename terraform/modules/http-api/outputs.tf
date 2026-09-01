output "api_id" {
  value = aws_apigatewayv2_api.this.id
}

output "api_endpoint" {
  value = aws_apigatewayv2_api.this.api_endpoint
}

output "execution_arn" {
  value = aws_apigatewayv2_api.this.execution_arn
}

output "vpc_link_id" {
  value = aws_apigatewayv2_vpc_link.this.id
}

output "authorizer_id" {
  value = aws_apigatewayv2_authorizer.jwt.id
}
