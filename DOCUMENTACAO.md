# 📖 Documentação Completa — Chat IA Bontech

O **Chat IA Bontech** é uma aplicação web completa, privada e modular em **Python (Flask)** com interface moderna no estilo **ChatGPT / Claude**, conectada a um motor de execução local de modelos de Inteligência Artificial (**Ollama**) containerizado com **Docker Compose**.

---

## 🎯 Sumário

1. [Visão Geral e Arquitetura](#1-visão-geral-e-arquitetura)
2. [Fluxo de Dados e Comunicação (Passo a Passo)](#2-fluxo-de-dados-e-comunicação-passo-a-passo)
3. [Estrutura do Projeto](#3-estrutura-do-projeto)
4. [Detalhamento dos Módulos](#4-detalhamento-dos-módulos)
5. [Endpoints da API Backend](#5-endpoints-da-api-backend)
6. [Gerenciamento de Modelos e Armazenamento](#6-gerenciamento-de-modelos-e-armazenamento)
7. [Guia de Comandos e Manutenção](#7-guia-de-comandos-e-manutenção)

---

## 1. Visão Geral e Arquitetura

O sistema opera em dois containers Docker totalmente isolados e integrados através de uma rede interna (`chatiabontech_default`):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            NAVEGADOR DO USUÁRIO                             │
│                         (http://localhost:5000)                             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / Streaming SSE
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Container: chatiabontech_web (Flask / Python 3.11)                          │
│ - Servidor de páginas estáticas e relé de APIs                              │
│ - Streaming de resposta token por token (Server-Sent Events)                │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP interno (http://ollama:11434)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Container: chatiabontech_ollama (Ollama Engine)                             │
│ - Carrega e executa os pesos das LLMs (Gemma 2, Qwen 2.5, Llama 3.2, etc.) │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Leitura / Escrita no Disco
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Pasta Local: ~/GitHub/chatiabontech/models/                                 │
│ - Armazenamento persistente de binários (.blobs) e manifests dos modelos    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Fluxo de Dados e Comunicação (Passo a Passo)

1. **Envio da Mensagem**: O usuário digita a pergunta na caixa de entrada e clica em enviar (ou pressiona `Enter`).
2. **Requisição AJAX (`chat.js`)**: O cliente recupera o histórico da sessão ativa no `localStorage` e dispara um `POST /api/chat` enviando o nome da LLM selecionada e as mensagens.
3. **Recepção no Flask (`app.py`)**: O Flask valida a requisição e conecta em streaming via HTTP com a API interna do Ollama (`http://ollama:11434/api/chat`).
4. **Inferência da LLM (Ollama Engine)**: O Ollama realiza o processamento matricial do prompt nos pesos do modelo armazenados na pasta `./models` e gera cada palavra (token).
5. **Streaming em Tempo Real (SSE)**: Conforme o Ollama produz cada token, o Flask repassa os dados via **Server-Sent Events (`text/event-stream`)** para o navegador.
6. **Renderização Dinâmica**: O frontend recebe o texto progressivamente, formata tabelas e marcações Markdown com `marked.js`, aplica coloração em blocos de código com `highlight.js` e adiciona botões de cópia.

---

## 3. Estrutura do Projeto

```text
/home/andre/GitHub/chatiabontech/
├── app.py                  # Servidor backend Flask e proxies SSE
├── docker-compose.yml      # Configuração da infraestrutura de containers
├── Dockerfile              # Imagem do container da aplicação Python
├── DOCUMENTACAO.md         # Documentação técnica do sistema
├── README.md               # Guia rápido de utilização
├── requirements.txt        # Dependências do Python (Flask, requests, gunicorn)
├── models/                 # Mapeamento local dos arquivos e pesos das LLMs
│   └── models/
│       ├── blobs/          # Pesos binários das redes neurais
│       └── manifests/      # Versões e registros dos modelos baixados
├── static/
│   ├── css/
│   │   └── style.css       # Tema escuro (Dark UI) estilo ChatGPT
│   └── js/
│       └── chat.js         # Gerenciador de streaming, sessões e interatividade
└── templates/
    └── index.html          # Estrutura HTML5 da SPA (Single Page Application)
```

---

## 4. Detalhamento dos Módulos

### Backend (`app.py`)
Escrito em Python 3 usando **Flask**. Suporta recarregamento em tempo real (hot-reload) e gerencia a ponte assíncrona entre o frontend e a API REST do Ollama.

### Containerização (`docker-compose.yml` / `Dockerfile`)
- **Porta 5000**: Exposta para o navegador.
- **Porta 11434**: Exposta para conexões locais do Ollama.
- **Volume Mount `./models`**: Garante que qualquer modelo baixado permaneça no disco do usuário mesmo que os containers sejam destruídos ou atualizados.
- **Volume Mount `./:/app`**: Sincroniza modificações no código instantaneamente.

### Frontend (`index.html`, `style.css`, `chat.js`)
- **ChatGPT Dark Theme**: Cores escuras de baixo contraste visual para uso prolongado (Slate `#0F172A`, Zinc `#1E293B` e detalhes em Verde Esmeralda `#10B981`).
- **Histórico Local**: Salvamento automático no `localStorage` do navegador para navegação entre conversas sem depender de banco de dados SQL.
- **Markdown & Highlight**: Suporte total a formatação de código com botão de cópia rápida.

---

## 5. Endpoints da API Backend

| Método | Endpoint | Descrição | Payload de Exemplo |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Verifica a integridade e saúde da conexão com o Ollama | *Nenhum* |
| `GET` | `/api/models` | Retorna a lista de modelos baixados disponíveis | *Nenhum* |
| `POST` | `/api/pull` | Dispara o download em segundo plano de uma nova LLM | `{"name": "gemma2:2b"}` |
| `POST` | `/api/chat` | Envia o histórico e recebe a resposta em fluxo streaming SSE | `{"model": "gemma2:2b", "messages": [...]}` |

---

## 6. Gerenciamento de Modelos e Armazenamento

Os modelos suportados e pré-testados incluem:

- **Google Gemma 2 (`gemma2:2b`)**: 1.6 GB — Otimizado, inteligente e rápido em Português.
- **Qwen 2.5 (`qwen2.5:0.5b`)**: 397 MB — Ultraleve para execução com consumo mínimo.
- **Meta Llama 3.2 (`llama3.2:1b`)**: 1.3 GB — Muito rápido e ideal para tarefas gerais.
- **Phi-3 Mini (`phi3:mini`)**: 2.3 GB — Alta inteligência para raciocínio lógico.

Todos os arquivos baixados são gravados em **`~/GitHub/chatiabontech/models/`**.

---

## 7. Guia de Comandos e Manutenção

```bash
# Iniciar a aplicação
cd ~/GitHub/chatiabontech && docker compose up -d

# Visualizar logs dos containers em tempo real
cd ~/GitHub/chatiabontech && docker compose logs -f

# Baixar um novo modelo via terminal
docker exec -it chatiabontech_ollama ollama pull <nome-do-modelo>

# Listar modelos instalados
docker exec -it chatiabontech_ollama ollama list

# Parar a aplicação
cd ~/GitHub/chatiabontech && docker compose down
```
