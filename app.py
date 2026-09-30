import os
import json
import requests
from flask import Flask, render_template, request, Response, jsonify, stream_with_context

app = Flask(__name__)

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
PORT = int(os.environ.get("PORT", 5000))

print(f"🚀 Iniciando Chat IA Bontech conectando ao Ollama em: {OLLAMA_HOST}")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/health", methods=["GET"])
def health():
    try:
        res = requests.get(f"{OLLAMA_HOST}/api/tags", timeout=3)
        if res.status_code == 200:
            return jsonify({"status": "ok", "ollama": "connected", "url": OLLAMA_HOST})
        return jsonify({"status": "warning", "ollama": f"HTTP {res.status_code}", "url": OLLAMA_HOST}), 502
    except Exception as e:
        return jsonify({"status": "error", "ollama": "disconnected", "error": str(e), "url": OLLAMA_HOST}), 503

@app.route("/api/models", methods=["GET"])
def list_models():
    """Lista modelos instalados no Ollama."""
    try:
        res = requests.get(f"{OLLAMA_HOST}/api/tags", timeout=5)
        if res.status_code == 200:
            data = res.json()
            models = [m.get("name") for m in data.get("models", [])]
            return jsonify({"models": models})
        return jsonify({"models": [], "error": f"Ollama respondeu HTTP {res.status_code}"}), 500
    except Exception as e:
        return jsonify({"models": [], "error": f"Não foi possível conectar ao Ollama ({str(e)})"}), 503

@app.route("/api/pull", methods=["POST"])
def pull_model():
    """Dispara o download (pull) de um modelo no Ollama com streaming SSE."""
    payload = request.get_json() or {}
    model_name = payload.get("name", "qwen2.5:0.5b").strip()

    if not model_name:
        return jsonify({"error": "Nome do modelo é obrigatório"}), 400

    def generate():
        try:
            req = requests.post(
                f"{OLLAMA_HOST}/api/pull",
                json={"name": model_name, "stream": True},
                stream=True,
                timeout=600
            )
            for line in req.iter_lines():
                if line:
                    decoded = line.decode('utf-8')
                    yield f"data: {decoded}\n\n"
        except Exception as e:
            err_json = json.dumps({"status": f"Erro: {str(e)}"})
            yield f"data: {err_json}\n\n"

    return Response(stream_with_context(generate()), content_type="text/event-stream")

@app.route("/api/chat", methods=["POST"])
def chat():
    """Envia histórico de mensagens para a LLM com streaming de resposta em tempo real."""
    data = request.get_json() or {}
    model = data.get("model", "qwen2.5:0.5b")
    messages = data.get("messages", [])
    system_prompt = data.get("system", "Você é um assistente de IA prestativo, inteligente e sucinto. Responda em Português do Brasil (pt-BR).")

    if not messages:
        return jsonify({"error": "Histórico de mensagens é obrigatório"}), 400

    # Adiciona system prompt caso não esteja presente no início
    full_messages = []
    if system_prompt:
        full_messages.append({"role": "system", "content": system_prompt})
    full_messages.extend(messages)

    payload = {
        "model": model,
        "messages": full_messages,
        "stream": True
    }

    def generate():
        try:
            res = requests.post(
                f"{OLLAMA_HOST}/api/chat",
                json=payload,
                stream=True,
                timeout=300
            )
            if res.status_code != 200:
                err_text = f"Erro no Ollama: HTTP {res.status_code}"
                yield f"data: {json.dumps({'error': err_text})}\n\n"
                return

            for line in res.iter_lines():
                if line:
                    decoded = line.decode('utf-8')
                    yield f"data: {decoded}\n\n"
        except Exception as e:
            err_msg = f"Falha ao conectar à LLM: {str(e)}"
            yield f"data: {json.dumps({'error': err_msg})}\n\n"

    return Response(stream_with_context(generate()), content_type="text/event-stream")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, debug=True)
