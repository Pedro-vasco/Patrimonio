# Patrimônio MVP

Sistema MVP de gestão patrimonial com backend em Node.js/TypeScript/Express/Prisma/PostgreSQL e frontend em React/Vite/TypeScript.

## Visão geral

O projeto foi estruturado em monorepo com duas aplicações:

- `backend/`: API REST para cadastro de ativos, execução de depreciação e relatórios.
- `frontend/`: interface web para operação básica do módulo patrimonial.

### Funcionalidades entregues

- Cadastro e edição de ativos patrimoniais
- Cadastro relacional via lookup de empresa, filial, centro de custo e categoria
- Seed inicial com empresa, filiais, centros de custo, categorias e ativos
- Motor de depreciação linear mensal
- Prevenção de duplicidade de depreciação por ativo/período
- Atualização automática de valor contábil líquido e status do ativo
- Relatório de posição patrimonial
- Relatório de mapa de depreciação por centro de custo, categoria ou filial

## Estrutura do repositório

```text
.
├── backend
│   ├── prisma
│   ├── src
│   └── tests
├── frontend
│   └── src
├── .env.example
└── docker-compose.yml
```

## Stack

### Backend

- Node.js
- TypeScript
- Express
- Prisma
- PostgreSQL
- Jest + ts-jest

### Frontend

- React
- Vite
- TypeScript
- Axios
- React Router DOM
- TanStack React Query

## Setup

> Este repositório foi preparado sem rodar instalações ou comandos Prisma. Após clonar, execute os passos abaixo localmente.

### 1. Subir o banco PostgreSQL

```bash
docker-compose up -d
```

### 2. Configurar variáveis de ambiente

Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

O arquivo de exemplo foi mantido com placeholder. Para uso real com o `docker-compose`, substitua por uma URL PostgreSQL válida, por exemplo `******localhost:5432/patrimonio`.

```env
DATABASE_URL="******localhost:5432/patrimonio"
PORT=3001
NODE_ENV=development
```

### 3. Instalar dependências

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 4. Criar o schema no banco

No diretório `backend/`:

```bash
npx prisma migrate dev --name init
```

### 5. Popular a base

Ainda em `backend/`:

```bash
npx prisma db seed
```

### 6. Executar o backend

```bash
cd backend
npm run dev
```

API disponível em `http://localhost:3001`.

### 7. Executar o frontend

```bash
cd frontend
npm run dev
```

Interface disponível em `http://localhost:5173`.

### 8. Variável do frontend

Se desejar configurar explicitamente a URL da API, crie um `.env` em `frontend/`:

```env
VITE_API_URL=http://localhost:3001/api
```

## Seed inicial

O seed cria:

- 1 empresa: `Empresa Exemplo Ltda`
- 2 filiais: `Matriz`, `Filial SP`
- 3 centros de custo: `TI`, `Administrativo`, `Operações`
- 4 categorias:
  - Móveis e Utensílios
  - Máquinas e Equipamentos
  - Veículos
  - Equipamentos de TI
- 1 regra de depreciação por categoria
- 6 ativos com datas históricas variadas

## Convenção de depreciação

- Método: linear mensal
- Fórmula:

```text
depreciação mensal = (valor de aquisição - valor residual) / vida útil em meses
```

- Sem pró-rata diário
- O ativo já deprecia no mês de entrada em operação
- Nunca deprecia abaixo do valor residual
- Quando valor líquido = valor residual, o status vira `FULLY_DEPRECIATED`

## Endpoints da API

Base URL da API funcional:

```text
http://localhost:3001/api
```

### Health

#### `GET /health`

Verifica se a aplicação backend está no ar.

Resposta:

```json
{
  "status": "ok",
  "timestamp": "2026-08-19T12:00:00.000Z"
}
```

### Lookups

#### `GET /api/lookups`

Retorna empresas, filiais, centros de custo e categorias para alimentar o frontend.

### Ativos

#### `GET /api/assets`

Lista ativos com paginação e filtros.

Query params:

- `page`
- `pageSize`
- `status`
- `categoryId`
- `branchId`
- `costCenterId`
- `search`

#### `POST /api/assets`

Cria um ativo.

Exemplo:

```json
{
  "companyId": "uuid-da-empresa",
  "branchId": "uuid-da-filial",
  "costCenterId": "uuid-do-centro",
  "assetCode": "TI-0100",
  "description": "Notebook Lenovo ThinkPad",
  "categoryId": "uuid-da-categoria",
  "acquisitionDate": "2025-01-10",
  "inServiceDate": "2025-01-15",
  "acquisitionValue": 6500,
  "residualValue": 650,
  "usefulLifeMonths": 48,
  "status": "ACTIVE"
}
```

#### `GET /api/assets/:id`

Retorna um ativo com relacionamentos, eventos e entradas de depreciação.

#### `PATCH /api/assets/:id`

Atualiza os campos permitidos de um ativo.

### Depreciação

#### `POST /api/depreciation/run`

Executa a depreciação do período.

Body:

```json
{
  "period": "2026-08",
  "bookType": "CONTABIL",
  "companyId": "uuid-da-empresa"
}
```

Regras aplicadas:

- processa somente ativos elegíveis no período
- impede duplicidade por ativo/período
- atualiza depreciação acumulada e valor líquido do ativo
- marca como `FULLY_DEPRECIATED` quando atingir o residual

#### `GET /api/depreciation/runs`

Lista execuções de depreciação com paginação.

Query params:

- `page`
- `pageSize`

### Relatórios

#### `GET /api/reports/position?period=YYYY-MM&companyId=<uuid>`

Retorna a posição patrimonial por ativo:

- `id`
- `code`
- `description`
- `category`
- `branch`
- `costCenter`
- `grossValue`
- `accumDepr`
- `netValue`

#### `GET /api/reports/depreciation-map?period=YYYY-MM&groupBy=costCenter|category|branch&companyId=<uuid>`

Retorna o mapa consolidado do período com:

- `group`
- `assetCount`
- `depreciationAmount`
- `grossValue`
- `netValue`

## Exemplo de execução da depreciação

1. Consulte os lookups para descobrir o `companyId`
2. Execute:

```bash
curl -X POST http://localhost:3001/api/depreciation/run \
  -H "Content-Type: application/json" \
  -d '{
    "period": "2026-08",
    "bookType": "CONTABIL",
    "companyId": "uuid-da-empresa"
  }'
```

3. Consulte o relatório:

```bash
curl "http://localhost:3001/api/reports/position?period=2026-08&companyId=uuid-da-empresa"
```

## Fluxo manual de validação

1. Suba o PostgreSQL com `docker-compose up -d`
2. Instale dependências em `backend/` e `frontend/`
3. Execute `npx prisma migrate dev --name init`
4. Execute `npx prisma db seed`
5. Inicie backend com `npm run dev` em `backend/`
6. Inicie frontend com `npm run dev` em `frontend/`
7. Acesse `http://localhost:5173`
8. Verifique:
   - Dashboard com KPIs carregados
   - Listagem de ativos populada
   - Criação de novo ativo
   - Edição de ativo existente
   - Execução de depreciação para um novo período
   - Relatório de posição patrimonial
   - Relatório de mapa de depreciação por centro de custo, categoria e filial
9. Execute os testes do backend:

```bash
cd backend
npm test
```

## Observações

- O frontend consome `VITE_API_URL` e usa `http://localhost:3001/api` como fallback.
- O backend expõe `GET /health` fora do prefixo `/api`.
- Troque o placeholder do `.env.example` por uma URL PostgreSQL válida antes de rodar Prisma.