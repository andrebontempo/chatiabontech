# 🤖 Chat IA Bontech (Interface Web estilo ChatGPT)

Aplicação Web em **Python (Flask)** com interface moderna no estilo **ChatGPT / Claude**, integrada a modelos de IA local executados via **Docker Compose** e Ollama.

---

## ⚡ Recursos Principais

- 💬 **Interface Estilo ChatGPT**: Design escuro (*Dark Mode*), suporte a histórico de conversas, avatares, Markdown e blocos de código com destaque de sintaxe e botão "Copiar".
- ⚡ **Respostas em Tempo Real (*Streaming SSE*)**: Os tokens são exibidos na tela conforme a LLM gera a resposta.
- 🦙 **LLMs em Docker**: Serviços containerizados e isolados, preparados para múltiplos modelos leves (incluindo Google Gemma 2, Meta Llama 3.2, Qwen 2.5).
- 🚀 **Modelos Leves Recomendados**:
  - `gemma2:2b` (1.6 GB — Google Gemma 2, excelente em Português)
  - `qwen2.5:0.5b` (apenas 398 MB — ideal para máquinas com pouca RAM / CPU)
  - `llama3.2:1b` (1.3 GB — extremamente rápido e inteligente)
  - `tinyllama` (637 MB)
  - `phi3:mini` (2.3 GB)
- ⬇️ **Gerenciador de Modelos**: Baixe novos modelos direto pela interface web ou via terminal.

---

## 🚀 Como Executar

### 1. Iniciar os Containers com Docker Compose
No diretório do projeto (`~/GitHub/chatiabontech`), execute:

```bash
docker compose up -d
```

Isso irá subir:
1. O serviço **Ollama** na porta `11434`.
2. A aplicação **Flask** na porta `5000`.

### 2. Baixar um Modelo Leve (Primeira Execução)

Você pode baixar um modelo diretamente pela **interface web** no botão **"Baixar Novo Modelo"**, ou via terminal com o comando:

```bash
# Baixar o modelo do Google Gemma 2 (1.6GB)
docker exec -it chatiabontech_ollama ollama pull gemma2:2b

# Baixar o modelo ultraleve qwen2.5:0.5b (398MB)
docker exec -it chatiabontech_ollama ollama pull qwen2.5:0.5b
```

### 3. Acessar a Interface
Abra o seu navegador e acesse:
👉 **[http://localhost:5000](http://localhost:5000)**

---

## 🛠️ Desenvolvimento Local (Sem Docker)

Se preferir rodar apenas o servidor Flask localmente conectado a uma instância Ollama já existente:

```bash
# Instalar dependências
pip install -r requirements.txt

# Executar a aplicação
python app.py
```

Acesse em `http://localhost:5000`.

---

## 📁 Estrutura do Projeto

```
~/GitHub/chatiabontech/
├── app.py                  # Servidor Flask e rotas de API com SSE streaming
├── Dockerfile              # Imagem Docker para a aplicação Flask
├── docker-compose.yml      # Orquestração dos containers Ollama + Flask
├── DOCUMENTACAO.md         # Documentação técnica completa
├── README.md               # Instruções de instalação e uso
├── requirements.txt        # Dependências Python (Flask, requests, gunicorn)
├── models/                 # Pasta local onde ficam salvas as LLMs baixadas
├── templates/
│   └── index.html          # Interface HTML do chat
└── static/
    ├── css/
    │   └── style.css       # Estilização CSS Dark Theme estilo ChatGPT
    └── js/
        └── chat.js         # Lógica do cliente, histórico e streaming
```
