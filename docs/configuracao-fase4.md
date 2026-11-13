# Configuracao Fase 4

Este guia distingue valores publicos (GitHub Variables), segredos do GitHub para pipelines e conteudo de secrets AWS. Substitua `REPLACE` antes do deploy. Nao cole segredos em issue, commit, log ou README.

## Secrets do GitHub neste repositorio

| Nome exato | Conteudo |
| --- | --- |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` | Sessao ativa do AWS Academy; renovar quando expirar |
| `SONAR_TOKEN` | Token de analise do projeto SonarCloud |

## Variables do GitHub neste repositorio

| Nome exato | Conteudo |
| --- | --- |
| `BACKEND_URL` | Base do LoadBalancer do OS, ex. `http://REPLACE-os-lb` |
| `BILLING_BACKEND_URL` | Base do LoadBalancer Billing |
| `PRODUCTION_BACKEND_URL` | Base do LoadBalancer Producao |
| `JWT_SECRET_ARN` | ARN do secret JWT compartilhado |
| `AUTH_CLIENT_LOOKUP_SECRET_ARN` | ARN do secret de lookup, com JSON `{"token":"REPLACE-random-min-32-bytes"}` |
| `OS_CLIENT_LOOKUP_URL` | Opcional; vazio deriva `api_endpoint` + `/api/v1/internal/auth/cliente`. Se preenchido, HTTPS obrigatorio |
| `SONAR_PROJECT_KEY`, `SONAR_ORGANIZATION` | Identificadores do projeto e organizacao SonarCloud |
| `DD_SITE` | Datadog site, default `datadoghq.com` |
| `DATADOG_ENABLED` | `true` para anexar as layers Datadog, `false` para desativar |
| `DATADOG_API_KEY_SECRET_ARN` | ARN de um secret com a API key como texto puro para a Datadog Lambda Extension quando habilitada |

O secret JWT deve conter `{"secret":"REPLACE-min-32-bytes","refreshSecret":"REPLACE-other-min-32-bytes"}`. O token de lookup deve ser aleatorio, diferente dos JWTs e configurado no OS pelo mesmo secret/valor. O pipeline nao cria o conteudo desses secrets; o usuario os cadastra no AWS Secrets Manager antes do deploy. As permissoes `secretsmanager:GetSecretValue` precisam existir na LabRole.

## Arquivos locais

Copiar `.env.example` para `.env` quando necessario. O codigo nao carrega dotenv automaticamente; exporte as variaveis no processo/invocador local. Em localhost pode usar `AUTH_CLIENT_LOOKUP_TOKEN` em vez de secret ARN; essa opcao e ignorada para URLs remotas. Localmente `OS_CLIENT_LOOKUP_URL=http://localhost:3000/api/v1/internal/auth/cliente`. Token com pelo menos 32 bytes. `CLIENT_LOOKUP_TIMEOUT_MS=5000` limita o tempo de consulta.

Copiar `terraform/terraform.tfvars.example` para `terraform/terraform.tfvars` ao usar Terraform local. Nao preencher o lookup URL no primeiro deploy: excluir a linha ou usar `os_client_lookup_url=""` permite derivar a URL HTTPS automaticamente. Preencher apenas os ARNs e URLs publicos; secret values ficam no Secrets Manager. O backend e o bucket `oficina-tc3-tfstate-REPLACE_ACCOUNT_ID`, key `oficina/auth/terraform.tfstate`, regiao `us-east-1`, criptografia e `use_lockfile=true`.

## Ordem de configuracao

1. Configurar AWS Academy e SonarCloud, com Quality Gate que bloqueie cobertura menor que 80%. Desativar analise automatica SonarCloud quando a analise for executada pelo CI.
2. Provisionar plataforma EKS e recursos proprios dos servicos; subir OS, Billing e Producao e obter os URLs dos LoadBalancers.
3. Cadastrar os secrets JWT e lookup na AWS; configurar o OS para validar o mesmo token de lookup.
4. Preencher Variables acima; `OS_CLIENT_LOOKUP_URL` pode ficar vazio. Executar Deploy somente apos CI aprovado.
5. Usar output `api_endpoint` como URL HTTPS publica do frontend. Configurar essa base nos `back_urls` e `notification_url` do Billing/Mercado Pago, conforme documentacao do Billing.
6. Conferir `POST /auth/token`, autorizacao nos tres servicos, login de operador, SPA em reload e webhook de teste antes da gravacao.

Em GitHub Settings -> Branches/Rulesets, exigir PR e checks `application` e `terraform` antes de merge; proteger administradores tambem. A execucao do Sonar e parte do check `application`. Credenciais ausentes ou Quality Gate reprovado fazem CI/deploy falharem; nao existe bypass silencioso.

Os contratos OpenAPI dos novos servicos ficam publicos em `GET /api/v1/billing/openapi.json` e `GET /api/v1/production/openapi.json`, encaminhados aos respectivos `/api/docs-json`. A UI Swagger de cada backend permanece em seu LoadBalancer `/api/docs`; no Gateway a UI `/api/docs` pertence ao OS.
