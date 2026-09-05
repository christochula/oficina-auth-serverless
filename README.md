# oficina-auth-serverless

Autenticação **serverless por CPF** e API Gateway da Oficina API. Executado no **AWS Academy Learner Lab**.

Repositório 3 (de 4) do Tech Challenge Fase 3. Ordem de deploy: `oficina-infra-kubernetes` → `oficina-infra-database` → **este** → `oficina-api`.

## Descrição

- **`POST /auth/token`** numa **AWS API Gateway HTTP API**: recebe um CPF (mascarado ou não), valida os dígitos, consulta o cliente ativo no PostgreSQL e devolve um **JWT HS256 curto** (300 s) com `sub = clientes.id`, `role = CLIENTE`, `token_use = client`, `scopes`, `jti`. O token **não contém o CPF**.
- **Lambda authorizer** (`REQUEST`, cache TTL 0) na rota protegida **`ANY /api/{proxy+}`**: valida HS256, `iss`, `aud`, `exp` e os claims obrigatórios; injeta headers internos `x-auth-*`.
- **Integração HTTP_PROXY** direta para a URL pública do `Service type: LoadBalancer` do EKS (`var.backend_url`). Rotas de probe, Swagger e login/refresh de operador ficam públicas.
- **Notificações** (`notification_enabled = true`): `SQS → Lambda → SNS`, com DLQ. Consumido pela aplicação para avisar sobre orçamentos.
- CPF inválido, cliente ausente e cliente inativo retornam **a mesma resposta 401** (anti-enumeração).

### Diferenças para o design corporativo (limitações do AWS Academy)

| Removido | Motivo | Alternativa |
| --- | --- | --- |
| IAM role por Lambda | `iam:CreateRole` bloqueado | todas as Lambdas usam a **`LabRole`** |
| VPC Link + ALB interno | depende do repo de EKS aplicado e de recursos de rede | API Gateway `HTTP_PROXY` (INTERNET) para a URL pública do ELB |
| Lambda em VPC | exigiria VPC endpoints / NAT para Secrets Manager | Lambda fora de VPC; RDS acessível publicamente com TLS forçado |
| KMS CMK nos secrets | `kms:CreateKey` não confiável | secrets com chave gerenciada |

O código TypeScript das três Lambdas (`src/`) **não mudou** — só a camada Terraform.

## Tecnologias

Node.js 22 + TypeScript + esbuild · AWS Lambda · API Gateway HTTP API · SQS/SNS · `pg` · Terraform 1.16 · GitHub Actions.

## Execução local

```bash
npm ci && npm run ci          # lint + typecheck + testes + build dos 3 bundles
terraform -chdir=terraform init \
  -backend-config="bucket=oficina-tc3-tfstate-$(aws sts get-caller-identity --query Account --output text)" \
  -backend-config="key=oficina/auth/terraform.tfstate" \
  -backend-config="region=us-east-1"
terraform -chdir=terraform plan
```

Veja `terraform/terraform.tfvars.example`.

## Deploy (CI/CD)

- `ci.yml` — PR/push: lint, typecheck, testes, build; `terraform fmt`/`validate`.
- `deploy.yml` — push `main` (+ manual): `npm run ci`, garante o bucket de state, `terraform apply`.

**GitHub Secrets** (renovar a cada sessão do Learner Lab): `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`.

**GitHub Variables** (preenchidas após os repos anteriores subirem):
| Variable | Origem |
| --- | --- |
| `DB_SECRET_ARN` | output `secret_arn` de `oficina-infra-database` |
| `JWT_SECRET_ARN` | secret `oficina/homolog/jwt` criado manualmente no Secrets Manager |
| `BACKEND_URL` | URL do LoadBalancer do EKS (`http://<elb-dns>`), após `oficina-api` subir |

## Contrato do JWT

| Claim | Valor |
| --- | --- |
| `iss` | `oficina-auth-serverless` |
| `aud` | `oficina-api` |
| `sub` / `client_id` | `clientes.id` |
| `role` | `CLIENTE` |
| `token_use` | `client` |
| `scopes` | `orders:read orders:write` |
| `exp` | 5 min |

## APIs

Contrato OpenAPI em [`openapi.yaml`](./openapi.yaml). Swagger da aplicação em `oficina-api` (`/api/docs`).

## Cleanup

```bash
terraform -chdir=terraform destroy
```

Destruir depois de `oficina-api` e antes de `oficina-infra-database`.
