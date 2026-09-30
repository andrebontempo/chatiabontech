/* ==========================================================================
   Ollama AI Chat - Client-side JS Logic (Streaming, History & Model Mgmt)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // DOM Elements
  const sidebar = document.getElementById('sidebar');
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  const btnNewChat = document.getElementById('btn-new-chat');
  const modelSelect = document.getElementById('model-select');
  const btnRefreshModels = document.getElementById('btn-refresh-models');
  const currentModelBadge = document.getElementById('current-model-badge');
  const statusIndicator = document.getElementById('status-indicator');
  const historyList = document.getElementById('history-list');
  const messagesContainer = document.getElementById('messages-container');
  const welcomeScreen = document.getElementById('welcome-screen');
  const chatMessages = document.getElementById('chat-messages');
  const chatForm = document.getElementById('chat-form');
  const userInput = document.getElementById('user-input');
  const btnSend = document.getElementById('btn-send');
  const btnClearChat = document.getElementById('btn-clear-chat');
  
  // Modal Elements
  const pullModal = document.getElementById('pull-modal');
  const btnOpenPullModal = document.getElementById('btn-open-pull-modal');
  const btnClosePullModal = document.getElementById('btn-close-pull-modal');
  const btnCancelPull = document.getElementById('btn-cancel-pull');
  const btnStartPull = document.getElementById('btn-start-pull');
  const customModelInput = document.getElementById('custom-model-input');
  const pullProgressBox = document.getElementById('pull-progress-box');
  const pullStatusText = document.getElementById('pull-status-text');
  const pullProgressFill = document.getElementById('pull-progress-fill');

  // Application State
  let sessions = JSON.parse(localStorage.getItem('ollama_chat_sessions') || '[]');
  let activeSessionId = localStorage.getItem('ollama_active_session') || null;
  let isGenerating = false;

  // Configure Marked JS Parser options
  marked.setOptions({
    highlight: function (code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
    breaks: true
  });

  // ---------------------------------------------------------------------------
  // 1. HEALTH CHECK & MODELS
  // ---------------------------------------------------------------------------

  async function checkHealth() {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        statusIndicator.querySelector('.status-dot').className = 'status-dot online';
        statusIndicator.querySelector('.status-text').textContent = 'Ollama Online';
      } else {
        statusIndicator.querySelector('.status-dot').className = 'status-dot offline';
        statusIndicator.querySelector('.status-text').textContent = 'Ollama Indisponível';
      }
    } catch (e) {
      statusIndicator.querySelector('.status-dot').className = 'status-dot offline';
      statusIndicator.querySelector('.status-text').textContent = 'Servidor Offline';
    }
  }

  async function fetchModels() {
    try {
      const res = await fetch('/api/models');
      const data = await res.json();
      
      modelSelect.innerHTML = '';
      if (data.models && data.models.length > 0) {
        data.models.forEach(modelName => {
          const opt = document.createElement('option');
          opt.value = modelName;
          opt.textContent = modelName;
          modelSelect.appendChild(opt);
        });

        // Set default or restore selected
        const savedModel = localStorage.getItem('ollama_selected_model');
        if (savedModel && data.models.includes(savedModel)) {
          modelSelect.value = savedModel;
        }
        updateModelBadge();
      } else {
        const opt = document.createElement('option');
        opt.value = 'qwen2.5:0.5b';
        opt.textContent = 'qwen2.5:0.5b (Recomendado)';
        modelSelect.appendChild(opt);
        updateModelBadge();
      }
    } catch (e) {
      console.warn('Erro ao carregar modelos:', e);
    }
  }

  function updateModelBadge() {
    const selected = modelSelect.value || 'qwen2.5:0.5b';
    currentModelBadge.textContent = selected;
    localStorage.setItem('ollama_selected_model', selected);

    const footerText = document.getElementById('input-footer-text');
    if (footerText) {
      footerText.textContent = `${selected} — Execução rápida e privada no seu computador.`;
    }
  }

  modelSelect.addEventListener('change', updateModelBadge);
  btnRefreshModels.addEventListener('click', fetchModels);

  // ---------------------------------------------------------------------------
  // 2. CHAT SESSIONS & HISTORY (LOCALSTORAGE)
  // ---------------------------------------------------------------------------

  function saveSessions() {
    localStorage.setItem('ollama_chat_sessions', JSON.stringify(sessions));
    localStorage.setItem('ollama_active_session', activeSessionId);
  }

  function createNewSession() {
    const id = 'session_' + Date.now();
    const newSession = {
      id: id,
      title: 'Nova Conversa',
      messages: [],
      createdAt: new Date().toISOString()
    };
    sessions.unshift(newSession);
    activeSessionId = id;
    saveSessions();
    renderHistoryList();
    renderCurrentSession();
    userInput.focus();
  }

  function getActiveSession() {
    if (!activeSessionId && sessions.length > 0) {
      activeSessionId = sessions[0].id;
    }
    return sessions.find(s => s.id === activeSessionId) || null;
  }

  function renderHistoryList() {
    historyList.innerHTML = '';
    sessions.forEach(sess => {
      const item = document.createElement('div');
      item.className = `history-item ${sess.id === activeSessionId ? 'active' : ''}`;
      
      item.innerHTML = `
        <i class="fa-regular fa-message" style="font-size: 0.85rem; color: var(--text-dim);"></i>
        <span class="history-item-title">${escapeHtml(sess.title)}</span>
        <button class="btn-del-history" title="Excluir conversa"><i class="fa-solid fa-trash-can"></i></button>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.btn-del-history')) {
          e.stopPropagation();
          deleteSession(sess.id);
        } else {
          activeSessionId = sess.id;
          saveSessions();
          renderHistoryList();
          renderCurrentSession();
        }
      });

      historyList.appendChild(item);
    });
  }

  function deleteSession(id) {
    sessions = sessions.filter(s => s.id !== id);
    if (activeSessionId === id) {
      activeSessionId = sessions.length > 0 ? sessions[0].id : null;
    }
    saveSessions();
    renderHistoryList();
    renderCurrentSession();
  }

  function renderCurrentSession() {
    const active = getActiveSession();
    chatMessages.innerHTML = '';

    if (!active || active.messages.length === 0) {
      welcomeScreen.style.display = 'flex';
      chatMessages.style.display = 'none';
      document.getElementById('chat-title-text').textContent = 'Nova Conversa';
    } else {
      welcomeScreen.style.display = 'none';
      chatMessages.style.display = 'flex';
      document.getElementById('chat-title-text').textContent = active.title;

      active.messages.forEach(msg => {
        appendMessageToUI(msg.role, msg.content, false);
      });
      scrollToBottom();
    }
  }

  btnClearChat.addEventListener('click', () => {
    const active = getActiveSession();
    if (active) {
      active.messages = [];
      active.title = 'Nova Conversa';
      saveSessions();
      renderHistoryList();
      renderCurrentSession();
    }
  });

  // ---------------------------------------------------------------------------
  // 3. UI MESSAGE RENDERING
  // ---------------------------------------------------------------------------

  function appendMessageToUI(role, content, isStreaming = false) {
    welcomeScreen.style.display = 'none';
    chatMessages.style.display = 'flex';

    const messageRow = document.createElement('div');
    messageRow.className = `message-row ${role}`;
    
    const avatarIcon = role === 'user' ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-robot"></i>';
    const senderName = role === 'user' ? 'Você' : 'Chat IA Bontech';

    messageRow.innerHTML = `
      <div class="message-avatar">${avatarIcon}</div>
      <div class="message-body">
        <div class="message-sender">${senderName}</div>
        <div class="message-content ${isStreaming ? 'streaming-cursor' : ''}"></div>
      </div>
    `;

    const contentBox = messageRow.querySelector('.message-content');
    if (role === 'assistant') {
      contentBox.innerHTML = marked.parse(content || '');
      addCopyButtonsToCodeBlocks(contentBox);
    } else {
      contentBox.textContent = content;
    }

    chatMessages.appendChild(messageRow);
    scrollToBottom();
    return contentBox;
  }

  function addCopyButtonsToCodeBlocks(container) {
    container.querySelectorAll('pre').forEach(pre => {
      if (pre.querySelector('.code-block-header')) return;

      const code = pre.querySelector('code');
      const lang = code ? (code.className.match(/language-(\w+)/) || [])[1] || 'code' : 'text';

      const header = document.createElement('div');
      header.className = 'code-block-header';
      header.innerHTML = `
        <span>${lang}</span>
        <button class="btn-copy-code"><i class="fa-regular fa-copy"></i> Copiar</button>
      `;

      const btnCopy = header.querySelector('.btn-copy-code');
      btnCopy.addEventListener('click', () => {
        const rawCode = code ? code.innerText : pre.innerText;
        navigator.clipboard.writeText(rawCode).then(() => {
          btnCopy.innerHTML = '<i class="fa-solid fa-check"></i> Copiado!';
          setTimeout(() => {
            btnCopy.innerHTML = '<i class="fa-regular fa-copy"></i> Copiar';
          }, 2000);
        });
      });

      pre.insertBefore(header, pre.firstChild);
    });
  }

  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // ---------------------------------------------------------------------------
  // 4. SEND MESSAGE & STREAMING RESPONSE
  // ---------------------------------------------------------------------------

  async function sendMessage() {
    const text = userInput.value.trim();
    if (!text || isGenerating) return;

    let session = getActiveSession();
    if (!session) {
      createNewSession();
      session = getActiveSession();
    }

    // Set title on first message
    if (session.messages.length === 0) {
      session.title = text.length > 30 ? text.substring(0, 30) + '...' : text;
      renderHistoryList();
    }

    // Append user message
    session.messages.push({ role: 'user', content: text });
    appendMessageToUI('user', text, false);

    userInput.value = '';
    adjustTextareaHeight();
    
    // Create assistant streaming element
    isGenerating = true;
    btnSend.disabled = true;
    const assistantContentBox = appendMessageToUI('assistant', '', true);

    let fullAssistantResponse = '';
    const selectedModel = modelSelect.value || 'qwen2.5:0.5b';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          messages: session.messages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.replace('data: ', '').trim();
            if (!jsonStr) continue;

            try {
              const data = JSON.parse(jsonStr);
              if (data.error) {
                fullAssistantResponse += `\n\n*(Erro: ${data.error})*`;
              } else if (data.message && data.message.content) {
                fullAssistantResponse += data.message.content;
              }
              assistantContentBox.innerHTML = marked.parse(fullAssistantResponse);
              addCopyButtonsToCodeBlocks(assistantContentBox);
              scrollToBottom();
            } catch (eErr) {}
          }
        }
      }
    } catch (err) {
      console.error('Streaming error:', err);
      fullAssistantResponse += `\n\n*(Erro de conexão com o Ollama: ${err.message})*`;
      assistantContentBox.innerHTML = marked.parse(fullAssistantResponse);
    } finally {
      assistantContentBox.classList.remove('streaming-cursor');
      isGenerating = false;
      btnSend.disabled = false;

      // Save assistant response
      session.messages.push({ role: 'assistant', content: fullAssistantResponse });
      saveSessions();
    }
  }

  // ---------------------------------------------------------------------------
  // 5. EVENT LISTENERS & MODAL PULL MODEL
  // ---------------------------------------------------------------------------

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage();
  });

  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  userInput.addEventListener('input', adjustTextareaHeight);

  function adjustTextareaHeight() {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 180) + 'px';
  }

  btnNewChat.addEventListener('click', createNewSession);

  btnToggleSidebar.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  // Prompt Cards Click
  document.querySelectorAll('.card-prompt').forEach(card => {
    card.addEventListener('click', () => {
      const promptText = card.getAttribute('data-prompt');
      if (promptText) {
        userInput.value = promptText;
        adjustTextareaHeight();
        sendMessage();
      }
    });
  });

  // Pull Model Modal
  btnOpenPullModal.addEventListener('click', () => pullModal.classList.add('active'));
  btnClosePullModal.addEventListener('click', () => pullModal.classList.remove('active'));
  btnCancelPull.addEventListener('click', () => pullModal.classList.remove('active'));

  document.querySelectorAll('.btn-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      customModelInput.value = chip.getAttribute('data-model');
    });
  });

  btnStartPull.addEventListener('click', async () => {
    const targetModel = customModelInput.value.trim();
    if (!targetModel) return;

    pullProgressBox.style.display = 'flex';
    pullStatusText.textContent = `Iniciando download do modelo '${targetModel}'...`;
    pullProgressFill.style.width = '10%';
    btnStartPull.disabled = true;

    try {
      const response = await fetch('/api/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: targetModel })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const rawJson = line.replace('data: ', '').trim();
            try {
              const data = JSON.parse(rawJson);
              if (data.status) {
                pullStatusText.textContent = data.status;
                if (data.total && data.completed) {
                  const pct = Math.round((data.completed / data.total) * 100);
                  pullProgressFill.style.width = pct + '%';
                }
              }
            } catch (e) {}
          }
        }
      }

      pullStatusText.textContent = `✅ Download concluído com sucesso! Modelo '${targetModel}' pronto para uso.`;
      pullProgressFill.style.width = '100%';
      await fetchModels();
      modelSelect.value = targetModel;
      updateModelBadge();

      setTimeout(() => {
        pullModal.classList.remove('active');
        pullProgressBox.style.display = 'none';
        btnStartPull.disabled = false;
      }, 1800);

    } catch (err) {
      pullStatusText.textContent = `❌ Erro ao baixar modelo: ${err.message}`;
      btnStartPull.disabled = false;
    }
  });

  // Helper escape HTML
  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Initial Boot
  checkHealth();
  fetchModels();
  renderHistoryList();
  renderCurrentSession();
  setInterval(checkHealth, 15000);
});
