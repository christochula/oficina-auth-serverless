# oficina-auth-serverless

Autenticacao por CPF, API Gateway HTTPS e notificacoes da Oficina (Fase 4). Repositorio de apoio aos tres microsservicos de negocio; nao acessa o banco de nenhum servico.

## Fluxo e contratos

`POST /auth/token` valida CPF, consulta o OS com `POST /api/v1/internal/auth/cliente` e `X-Internal-Token`, e emite JWT HS256 de 300 segundos. CPF invalido, cliente ausente e inativo recebem a mesma resposta 401. O lookup exige HTTPS em producao, tem timeout de 5 segundos, rejeita redirects e aceita resposta `{id,nome,email,ativo}` ou `{data:{id,nome,email,ativo}}`. Nenhum CPF ou token e registrado nos logs.

O token mantem `iss=oficina-auth-serverless`, `aud=oficina-api`, `sub=client_id`, `role=CLIENTE`, `token_use=client`, `scopes` e `jti`; nao inclui CPF. Operadores continuam autenticando pelo OS. Cada microsservico verifica JWT, papel e propriedade dos recursos independentemente.

| Rota do Gateway | Destino e protecao |
| --- | --- |
| `POST /auth/token` | Lambda emissora; publica |
| `/api/v1/billing/{proxy+}` | Billing; authorizer JWT |
| `/api/v1/production/{proxy+}` | Producao; authorizer JWT |
| `POST /api/v1/billing/webhooks/mercadopago` | Billing; sem JWT, valida assinatura Mercado Pago no aplicativo |
| `GET /api/v1/billing/openapi.json`, `/api/v1/production/openapi.json` | Contratos OpenAPI publicos dos backends (`/api/docs-json`) |
| `POST /api/v1/internal/auth/cliente` | OS; sem JWT de usuario, exige `X-Internal-Token` no aplicativo |
| `GET /api/v1/billing/health`, `/api/v1/production/health` | Saude publica dos servicos |
| `/api/{proxy+}` | OS; authorizer com allowlist de health/docs/login/refresh |
| `$default` | Frontend/estaticos/SPA servidos pelo OS; publico |

Rotas especificas tem precedencia sobre `$default`. Os backends tambem protegem suas APIs quando acessados diretamente pelo LoadBalancer. Notificacoes preservam SQS -> Lambda -> SNS, DLQ e falhas parciais por lote; as filas de negocio/Saga pertencem aos respectivos servicos.

## Execucao e qualidade

Node.js 22, TypeScript, esbuild e Terraform 1.16.

```bash
npm ci
npm run ci
terraform -chdir=terraform init -backend=false
terraform -chdir=terraform fmt -check -recursive
terraform -chdir=terraform validate
```

CI executa lint, typecheck, testes, build e SonarCloud com espera pelo Quality Gate. O gate Jest exige 80% em linhas, statements, funcoes e branches, incluindo todos os fontes exceto tipos. Cobertura local verificada: 55 testes; 90,21% statements, 87,82% branches, 91,48% funcoes e 90,44% linhas. O artefato `auth-coverage` do workflow contem `lcov.info` e a evidencia por execucao; o relatorio local esta em `coverage/lcov-report/index.html`. Valores locais nao comprovam um run publicado.

## Configuracao e deploy

Veja [o guia de configuracao](docs/configuracao-fase4.md), `.env.example` e `terraform/terraform.tfvars.example`. O usuario configura credenciais e contas externas; nenhum segredo e versionado. Nao e necessario `DB_SECRET_ARN`, `pg` nem permissao de acesso PostgreSQL.

Depois do cluster e dos tres backends, configurar os tres URLs de LoadBalancer e executar o workflow `Deploy`. O Terraform deriva a URL HTTPS do lookup do proprio Gateway quando `OS_CLIENT_LOOKUP_URL` nao e informado. O output `api_endpoint` e a URL unica do frontend e a base para os retornos/webhook do Mercado Pago. Nao ha etapa manual de copiar URL para a Lambda apos o primeiro apply.

Os workflows CI e Deploy verificam qualidade antes de publicar as Lambdas. Proteger `main` com PR obrigatorio e checks `application` e `terraform`; `.github/settings.yml` e apenas uma declaracao, cuja aplicacao deve ser conferida no GitHub. Os testes locais nao acessam AWS, OS remoto ou Mercado Pago.

Contrato OpenAPI em [openapi.yaml](openapi.yaml). Contratos de negocio permanecem no Swagger de cada microsservico. State exclusivo: `oficina/auth/terraform.tfstate`. Lambdas usam `LabRole` do Academy e executam fora da VPC, consultando OS via HTTPS.

## Evidencias publicadas e homologacao

Snapshot de 06/11/2026, commit `5bd146a`:

- [CI aprovado](https://github.com/christochula/oficina-auth-serverless/actions/runs/42141606611), incluindo o quality gate Sonar obrigatorio.
- [SonarCloud](https://sonarcloud.io/dashboard?id=christochula-oficina_oficina-auth-serverless): cobertura **88,7%**, linhas 89,3% e branches 87,8%; quality gate aprovado. Essas metricas Sonar sao distintas do resumo Jest local.
- [Relatorio de cobertura](https://github.com/christochula/oficina-auth-serverless/actions/runs/42141606611/artifacts/13502070376): artifact `auth-coverage` da mesma execucao CI.
- [Apply/deploy aprovado pelo GitHub Actions](https://github.com/christochula/oficina-auth-serverless/actions/runs/42226810439): Gateway e Lambdas publicados na homologacao.
- [Portal e base HTTPS do Gateway](https://8phthn792m.execute-api.us-east-1.amazonaws.com); o endpoint de emissao e `POST /auth/token`, conforme [OpenAPI da autenticacao](openapi.yaml).
- Contratos publicos verificados com HTTP200: [Swagger OS](https://8phthn792m.execute-api.us-east-1.amazonaws.com/api/docs), [OpenAPI Billing](https://8phthn792m.execute-api.us-east-1.amazonaws.com/api/v1/billing/openapi.json) e [OpenAPI Production](https://8phthn792m.execute-api.us-east-1.amazonaws.com/api/v1/production/openapi.json).

A disponibilidade dos backends depende da sessao ativa do AWS Academy e da renovacao das credenciais temporarias via GitHub Actions.
