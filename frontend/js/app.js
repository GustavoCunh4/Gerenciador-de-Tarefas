// js/app.js

// ----------------------
// Configuracao da API
// ----------------------
const API_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:8000"
    : "";

const STATUS_LABELS = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluida"
};

// ----------------------
// Estado da aplicacao
// ----------------------
const state = {
  currentUser: null, // { id, email }
  tasks: [], // array de tarefas vindas da API
  filter: {
    status: "all"
  },
  viewMode: "list",
  editingTaskId: null,
  editingDraft: null
};

// ----------------------
// Camada de dados: chamadas a API
// ----------------------

async function handleResponse(response) {
  let data = {};
  try {
    data = await response.json();
  } catch (_) {
    data = {};
  }

  if (!response.ok) {
    const msg = data.detail || "Erro na requisicao.";
    throw new Error(msg);
  }

  return data;
}

async function apiRegisterUser(email, password) {
  const response = await fetch(`${API_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  return handleResponse(response);
}

async function apiLoginUser(email, password) {
  const response = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  return handleResponse(response);
}

async function apiGetTasks(userId, filters = {}) {
  const params = new URLSearchParams({ user_id: userId });
  if (filters.status && filters.status !== "all") {
    params.append("status", filters.status);
  }

  const response = await fetch(`${API_URL}/tasks?${params.toString()}`);
  return handleResponse(response);
}

async function apiCreateTask(userId, title, description, dataInicial, dataLimite, status) {
  const payload = {
    user_id: userId,
    title,
    description,
    data_inicial: dataInicial || null,
    data_limite: dataLimite || null,
    status: status || "pendente"
  };

  const response = await fetch(`${API_URL}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  return handleResponse(response);
}

async function apiUpdateTask(taskId, payload) {
  const response = await fetch(`${API_URL}/tasks/${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return handleResponse(response);
}

async function apiDeleteTask(taskId) {
  const response = await fetch(`${API_URL}/tasks/${taskId}`, {
    method: "DELETE"
  });
  return handleResponse(response);
}

// ----------------------
// Inicializacao da UI
// ----------------------
document.addEventListener("DOMContentLoaded", () => {
  // Elementos principais
  const authSection = document.getElementById("auth-section");
  const todoSection = document.getElementById("todo-section");

  // Tabs de login/cadastro
  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");

  // Mensagens
  const loginMessage = document.getElementById("login-message");
  const registerMessage = document.getElementById("register-message");
  const taskMessage = document.getElementById("task-message");

  // Secao TODO
  const currentUserEmailEl = document.getElementById("current-user-email");
  const logoutButton = document.getElementById("logout-button");

  const taskForm = document.getElementById("task-form");
  const taskTitleInput = document.getElementById("task-title");
  const taskDescriptionInput = document.getElementById("task-description");
  const taskDataInicialInput = document.getElementById("task-data-inicial");
  const taskDataLimiteInput = document.getElementById("task-data-limite");
  const taskStatusSelect = document.getElementById("task-status");

  const taskList = document.getElementById("task-list");
  const emptyState = document.getElementById("empty-state");
  const taskSummary = document.getElementById("task-summary");
  const speechButton = document.getElementById("speech-task-button");
  const listView = document.getElementById("list-view");
  const matrixView = document.getElementById("matrix-view");
  const viewToggleButtons = document.querySelectorAll(".view-toggle .btn");

  const matrixZones = {
    "important-urgent": document.getElementById("zone-important-urgent"),
    "important-not-urgent": document.getElementById("zone-important-not-urgent"),
    "not-important-urgent": document.getElementById("zone-not-important-urgent"),
    "not-important-not-urgent": document.getElementById("zone-not-important-not-urgent")
  };

  let recognition = null;
  let isListening = false;

  const statusFilterGroup = document.getElementById("status-filter-group");
  const taskCountPill = document.getElementById("task-count-pill");
  const reloadButton = document.getElementById("reload-tasks");

  // ----------------------
  // Helpers de UI
  // ----------------------
  function clearMessages() {
    [loginMessage, registerMessage, taskMessage].forEach((el) => {
      if (!el) return;
      el.textContent = "";
      el.className = "form-message";
    });
  }

  function setTaskMessage(msg, type = "info") {
    taskMessage.textContent = msg;
    taskMessage.className = "form-message";
    if (type === "error") taskMessage.classList.add("error");
    if (type === "success") taskMessage.classList.add("success");
  }

  function showAuthSection() {
    authSection.classList.remove("hidden");
    todoSection.classList.add("hidden");
    clearMessages();
  }

  function showTodoSection() {
    authSection.classList.add("hidden");
    todoSection.classList.remove("hidden");
    clearMessages();
    currentUserEmailEl.textContent = state.currentUser?.email || "";
    loadAndRenderTasks();
  }

  function switchToLogin() {
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");

    loginForm.classList.add("active");
    registerForm.classList.remove("active");

    clearMessages();
  }

  function switchToRegister() {
    tabLogin.classList.remove("active");
    tabRegister.classList.add("active");

    loginForm.classList.remove("active");
    registerForm.classList.add("active");

    clearMessages();
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  function formatStatus(status) {
    if (!status) return "";
    const normalized = status.toLowerCase();
    return STATUS_LABELS[normalized] || normalized;
  }

  function setStatusFilter(value) {
    state.filter.status = value;
    [...statusFilterGroup.querySelectorAll(".chip")].forEach((chip) => {
      const chipStatus = chip.getAttribute("data-status");
      chip.classList.toggle("active", chipStatus === value);
    });
    loadAndRenderTasks();
  }

  function updateTaskSummary(tasks) {
    const total = tasks.length;
    const suffix = total === 1 ? "tarefa" : "tarefas";
    const filterLabel =
      state.filter.status === "all" ? "todas" : `status ${formatStatus(state.filter.status)}`;

    taskCountPill.textContent = `${total} ${suffix}`;
    taskSummary.textContent = total
      ? `Mostrando ${total} ${suffix} com ${filterLabel}.`
      : `Nenhuma tarefa encontrada para ${filterLabel}.`;
  }

  function resetEditingState() {
    state.editingTaskId = null;
    state.editingDraft = null;
  }

  function setViewMode(mode) {
    state.viewMode = mode;
    if (mode === "list") {
      listView.classList.remove("hidden");
      matrixView.classList.add("hidden");
    } else {
      matrixView.classList.remove("hidden");
      listView.classList.add("hidden");
    }

    viewToggleButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === mode);
    });
  }

  function startEditTask(task) {
    state.editingTaskId = task.id;
    state.editingDraft = {
      title: task.title,
      description: task.description || "",
      data_inicial: task.data_inicial ? task.data_inicial.slice(0, 10) : "",
      data_limite: task.data_limite ? task.data_limite.slice(0, 10) : "",
      status: task.status || "pendente"
    };
    renderTasks();
  }

  function updateDraft(field, value) {
    if (!state.editingDraft) return;
    state.editingDraft[field] = value;
  }

  // ----------------------
  // Voz: helpers
  // ----------------------
  function normalizeDate(text) {
    if (!text) return null;
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  }

  function extractField(text, keywords) {
    const lower = text.toLowerCase();
    return keywords.some((kw) => lower.includes(kw));
  }

  function parseSpeech(text) {
    const parts = text.split(/;|\\n/).map((p) => p.trim()).filter(Boolean);
    const data = {
      title: "",
      description: "",
      data_inicial: null,
      data_limite: null,
      status: null,
    };

    const statusMap = {
      pendente: "pendente",
      pendentes: "pendente",
      "em andamento": "em_andamento",
      andamento: "em_andamento",
      concluida: "concluida",
      concluido: "concluida",
      concluida: "concluida",
    };

    const tryStatus = (chunk) => {
      const lower = chunk.toLowerCase();
      for (const key of Object.keys(statusMap)) {
        if (lower.includes(key)) return statusMap[key];
      }
      return null;
    };

    parts.forEach((chunk) => {
      const lower = chunk.toLowerCase();
      if (extractField(chunk, ["titulo", "título", "nome"])) {
        data.title = chunk.split(/titulo|título|nome/i).pop().trim() || data.title;
      } else if (extractField(chunk, ["descricao", "descrição"])) {
        data.description = chunk.split(/descricao|descrição/i).pop().trim() || data.description;
      } else if (extractField(chunk, ["data inicial", "inicio", "início"])) {
        const rest = chunk.split(/data inicial|inicio|início/i).pop().trim();
        data.data_inicial = normalizeDate(rest);
      } else if (extractField(chunk, ["data limite", "prazo", "deadline"])) {
        const rest = chunk.split(/data limite|prazo|deadline/i).pop().trim();
        data.data_limite = normalizeDate(rest);
      } else if (extractField(chunk, ["status"])) {
        const rest = chunk.split(/status/i).pop().trim();
        data.status = tryStatus(rest) || data.status;
      } else {
        // fallback: se vier solto e não tiver titulo ainda, assuma que é titulo
        if (!data.title) data.title = chunk;
      }

      if (!data.status) {
        const guess = tryStatus(chunk);
        if (guess) data.status = guess;
      }
    });

    return data;
  }

  // ----------------------
  // Renderizacao de tarefas
  // ----------------------
  function renderTasks() {
    const tasks = state.tasks || [];
    taskList.innerHTML = "";

    if (!tasks.length) {
      emptyState.style.display = "block";
      updateTaskSummary(tasks);
      renderMatrix(tasks);
      return;
    }

    emptyState.style.display = "none";
    updateTaskSummary(tasks);
    renderMatrix(tasks);

    tasks
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .forEach((task) => {
        const li = document.createElement("li");
        li.className = "task-item";

        const header = document.createElement("div");
        header.className = "task-item-header";

        const titleEl = document.createElement("span");
        titleEl.className = "task-title";
        titleEl.textContent = task.title;

        const statusBadge = document.createElement("span");
        const badgeClass = `status-${task.status || "pendente"}`;
        statusBadge.className = `status-badge ${badgeClass}`;
        statusBadge.innerHTML = `<span></span>${formatStatus(task.status)}`;

        const rightHeader = document.createElement("div");
        rightHeader.style.display = "flex";
        rightHeader.style.alignItems = "center";
        rightHeader.style.gap = "10px";

        const dateEl = document.createElement("span");
        dateEl.className = "task-date";
        const date = new Date(task.created_at);
        dateEl.textContent = date.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });

        rightHeader.appendChild(statusBadge);
        rightHeader.appendChild(dateEl);

        header.appendChild(titleEl);
        header.appendChild(rightHeader);
        li.appendChild(header);

        if (task.description) {
          const descEl = document.createElement("p");
          descEl.className = "task-description";
          descEl.textContent = task.description;
          li.appendChild(descEl);
        }

        const metaParts = [];

        if (task.data_inicial) {
          metaParts.push(`Inicio: ${formatDate(task.data_inicial)}`);
        }
        if (task.data_limite) {
          metaParts.push(`Limite: ${formatDate(task.data_limite)}`);
        }

        if (metaParts.length) {
          const metaEl = document.createElement("p");
          metaEl.className = "task-meta";
          metaEl.textContent = metaParts.join(" • ");
          li.appendChild(metaEl);
        }

        const actionsEl = document.createElement("div");
        actionsEl.className = "task-actions";

        const editBtn = document.createElement("button");
        editBtn.className = "btn btn-edit";
        editBtn.textContent = "Editar";
        editBtn.title = "Editar tarefa";
        editBtn.addEventListener("click", () => {
          clearMessages();
          startEditTask(task);
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn btn-delete";
        deleteBtn.textContent = "Apagar";
        deleteBtn.title = "Apagar tarefa";

        deleteBtn.addEventListener("click", async () => {
          const confirmar = confirm("Tem certeza que deseja apagar esta tarefa?");
          if (!confirmar) return;

          clearMessages();

          try {
            await apiDeleteTask(task.id);
            taskMessage.textContent = "Tarefa apagada com sucesso.";
            taskMessage.classList.add("success");
            await loadAndRenderTasks();
          } catch (err) {
            taskMessage.textContent = "Erro ao apagar tarefa: " + err.message;
            taskMessage.classList.add("error");
          }
        });

        actionsEl.appendChild(editBtn);
        actionsEl.appendChild(deleteBtn);
        li.appendChild(actionsEl);

        const isEditing = state.editingTaskId === task.id;
        if (isEditing && state.editingDraft) {
          const draft = state.editingDraft;
          const editPanel = document.createElement("div");
          editPanel.className = "edit-panel";

          // Titulo
          const titleGroup = document.createElement("div");
          titleGroup.className = "form-group";
          const titleLabel = document.createElement("label");
          titleLabel.textContent = "Titulo";
          const titleInput = document.createElement("input");
          titleInput.type = "text";
          titleInput.value = draft.title;
          titleInput.addEventListener("input", (e) => updateDraft("title", e.target.value));
          titleGroup.appendChild(titleLabel);
          titleGroup.appendChild(titleInput);
          editPanel.appendChild(titleGroup);

          // Status
          const statusGroup = document.createElement("div");
          statusGroup.className = "form-group";
          const statusLabel = document.createElement("label");
          statusLabel.textContent = "Status";
          const statusSelect = document.createElement("select");
          ["pendente", "em_andamento", "concluida"].forEach((value) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = formatStatus(value);
            if (draft.status === value) option.selected = true;
            statusSelect.appendChild(option);
          });
          statusSelect.addEventListener("change", (e) => updateDraft("status", e.target.value));
          statusGroup.appendChild(statusLabel);
          statusGroup.appendChild(statusSelect);
          editPanel.appendChild(statusGroup);

          // Datas
          const startGroup = document.createElement("div");
          startGroup.className = "form-group";
          const startLabel = document.createElement("label");
          startLabel.textContent = "Data inicial";
          const startInput = document.createElement("input");
          startInput.type = "date";
          startInput.value = draft.data_inicial || "";
          startInput.addEventListener("change", (e) => updateDraft("data_inicial", e.target.value));
          startGroup.appendChild(startLabel);
          startGroup.appendChild(startInput);
          editPanel.appendChild(startGroup);

          const endGroup = document.createElement("div");
          endGroup.className = "form-group";
          const endLabel = document.createElement("label");
          endLabel.textContent = "Data limite";
          const endInput = document.createElement("input");
          endInput.type = "date";
          endInput.value = draft.data_limite || "";
          endInput.addEventListener("change", (e) => updateDraft("data_limite", e.target.value));
          endGroup.appendChild(endLabel);
          endGroup.appendChild(endInput);
          editPanel.appendChild(endGroup);

          // Descricao
          const descGroup = document.createElement("div");
          descGroup.className = "form-group full-row";
          const descLabel = document.createElement("label");
          descLabel.textContent = "Descricao";
          const descInput = document.createElement("textarea");
          descInput.value = draft.description || "";
          descInput.placeholder = "Atualize detalhes da tarefa";
          descInput.addEventListener("input", (e) => updateDraft("description", e.target.value));
          descGroup.appendChild(descLabel);
          descGroup.appendChild(descInput);
          editPanel.appendChild(descGroup);

          // Acoes
          const editActions = document.createElement("div");
          editActions.className = "edit-actions";

          const cancelEditBtn = document.createElement("button");
          cancelEditBtn.type = "button";
          cancelEditBtn.className = "btn ghost small";
          cancelEditBtn.textContent = "Cancelar";
          cancelEditBtn.addEventListener("click", () => {
            resetEditingState();
            renderTasks();
          });

          const saveEditBtn = document.createElement("button");
          saveEditBtn.type = "button";
          saveEditBtn.className = "btn primary small";
          saveEditBtn.textContent = "Salvar";
          saveEditBtn.addEventListener("click", async () => {
            clearMessages();

            if (!draft.title || !draft.title.trim()) {
              taskMessage.textContent = "O titulo da tarefa e obrigatorio.";
              taskMessage.classList.add("error");
              return;
            }

            try {
              await apiUpdateTask(task.id, {
                user_id: state.currentUser.id,
                title: draft.title.trim(),
                description: draft.description,
                data_inicial: draft.data_inicial || null,
                data_limite: draft.data_limite || null,
                status: draft.status
              });
              taskMessage.textContent = "Tarefa atualizada com sucesso.";
              taskMessage.classList.add("success");
              resetEditingState();
              await loadAndRenderTasks();
            } catch (err) {
              taskMessage.textContent = "Erro ao atualizar tarefa: " + err.message;
              taskMessage.classList.add("error");
            }
          });

          editActions.appendChild(cancelEditBtn);
          editActions.appendChild(saveEditBtn);
          editPanel.appendChild(editActions);

          li.appendChild(editPanel);
        }

        taskList.appendChild(li);
      });
  }

  function classifyTasksForMatrix(tasks) {
    const zones = {
      "important-urgent": [],
      "important-not-urgent": [],
      "not-important-urgent": [],
      "not-important-not-urgent": []
    };

    const now = new Date();
    tasks.forEach((task) => {
      let daysDiff = null;
      if (task.data_limite) {
        const limit = new Date(task.data_limite);
        daysDiff = Math.ceil((limit - now) / (1000 * 60 * 60 * 24));
      }

      const isUrgent = daysDiff !== null && daysDiff <= 2;
      const isImportant =
        task.status === "em_andamento" ||
        (daysDiff !== null && daysDiff <= 7);

      let zoneKey = "not-important-not-urgent";

      if (task.status === "concluida") {
        zoneKey = "not-important-not-urgent";
      } else if (isImportant && isUrgent) {
        zoneKey = "important-urgent";
      } else if (isImportant && !isUrgent) {
        zoneKey = "important-not-urgent";
      } else if (!isImportant && isUrgent) {
        zoneKey = "not-important-urgent";
      }

      zones[zoneKey].push(task);
    });

    return zones;
  }

  function renderMatrix(tasks) {
    const zones = classifyTasksForMatrix(tasks);

    Object.entries(matrixZones).forEach(([zoneKey, container]) => {
      container.innerHTML = "";
      const zoneTasks = zones[zoneKey] || [];
      if (!zoneTasks.length) {
        const empty = document.createElement("p");
        empty.className = "matrix-empty";
        empty.textContent = "Sem tarefas aqui.";
        container.appendChild(empty);
        return;
      }

      zoneTasks
        .slice()
        .sort((a, b) => new Date(a.data_limite || a.created_at) - new Date(b.data_limite || b.created_at))
        .forEach((task) => {
          const item = document.createElement("div");
          item.className = "matrix-item";

          const title = document.createElement("div");
          title.className = "title";
          title.textContent = task.title;

          const meta = document.createElement("div");
          meta.className = "meta";
          const parts = [];
          if (task.data_limite) parts.push(`Limite: ${formatDate(task.data_limite)}`);
          parts.push(formatStatus(task.status));
          meta.textContent = parts.join(" • ");

          item.appendChild(title);
          item.appendChild(meta);
          container.appendChild(item);
        });
    });
  }

  // ----------------------
  // Voz: setup
  // ----------------------
  if (speechButton) {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SpeechRecognition();
      recognition.lang = "pt-BR";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        isListening = true;
        speechButton.classList.add("listening");
        setTaskMessage("Ouvindo... fale: titulo; descricao; data inicial; data limite; status.");
      };

      recognition.onend = () => {
        isListening = false;
        speechButton.classList.remove("listening");
      };

      recognition.onerror = (event) => {
        setTaskMessage("Nao foi possivel capturar audio: " + (event.error || "erro"), "error");
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const parsed = parseSpeech(transcript);

        if (parsed.title) taskTitleInput.value = parsed.title;
        if (parsed.description) taskDescriptionInput.value = parsed.description;
        if (parsed.data_inicial) taskDataInicialInput.value = parsed.data_inicial;
        if (parsed.data_limite) taskDataLimiteInput.value = parsed.data_limite;
        if (parsed.status) taskStatusSelect.value = parsed.status;

        setTaskMessage("Preenchido via voz. Reveja e clique em Adicionar.", "success");
      };

      speechButton.addEventListener("click", () => {
        if (isListening) {
          recognition.stop();
          return;
        }
        clearMessages();
        recognition.start();
      });
    } else {
      speechButton.disabled = true;
      speechButton.title = "Captura de voz nao suportada neste navegador.";
    }
  }

  async function loadAndRenderTasks() {
    if (!state.currentUser) {
      state.tasks = [];
      renderTasks();
      return;
    }

    try {
      const tasks = await apiGetTasks(state.currentUser.id, {
        status: state.filter.status
      });
      state.tasks = tasks;
      renderTasks();
    } catch (err) {
      taskMessage.textContent = "Erro ao carregar tarefas: " + err.message;
      taskMessage.classList.add("error");
    }
  }

  // ----------------------
  // Eventos de tabs
  // ----------------------
  tabLogin.addEventListener("click", () => {
    switchToLogin();
  });

  tabRegister.addEventListener("click", () => {
    switchToRegister();
  });

  // ----------------------
  // Eventos de autenticacao
  // ----------------------
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessages();

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();

    if (!email || !password) {
      loginMessage.textContent = "Preencha e-mail e senha.";
      loginMessage.classList.add("error");
      return;
    }

    try {
      const user = await apiLoginUser(email, password);
      state.currentUser = user;
      showTodoSection();
    } catch (err) {
      loginMessage.textContent = err.message;
      loginMessage.classList.add("error");
    }
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessages();

    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value.trim();

    if (!email || !password) {
      registerMessage.textContent = "Preencha e-mail e senha.";
      registerMessage.classList.add("error");
      return;
    }

    try {
      await apiRegisterUser(email, password);
      registerMessage.textContent = "Cadastro realizado! Voce ja pode entrar.";
      registerMessage.classList.add("success");

      setTimeout(() => {
        switchToLogin();
      }, 800);
    } catch (err) {
      registerMessage.textContent = err.message;
      registerMessage.classList.add("error");
    }
  });

  logoutButton.addEventListener("click", () => {
    state.currentUser = null;
    state.tasks = [];
    resetEditingState();
    showAuthSection();
    switchToLogin();
  });

  // ----------------------
  // Eventos de filtro
  // ----------------------
  statusFilterGroup.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-status]");
    if (!chip) return;
    const status = chip.getAttribute("data-status");
    setStatusFilter(status);
  });

  viewToggleButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      setViewMode(view);
    });
  });

  reloadButton.addEventListener("click", () => {
    clearMessages();
    loadAndRenderTasks();
  });

  // ----------------------
  // Evento de criacao de tarefa
  // ----------------------
  taskForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessages();

    const title = taskTitleInput.value.trim();
    const description = taskDescriptionInput.value.trim();
    const dataInicial = taskDataInicialInput.value || null;
    const dataLimite = taskDataLimiteInput.value || null;
    const status = taskStatusSelect.value || "pendente";

    if (!title) {
      taskMessage.textContent = "O titulo da tarefa e obrigatorio.";
      taskMessage.classList.add("error");
      return;
    }

    if (!state.currentUser) {
      setTaskMessage("Voce precisa estar logado para criar tarefas.", "error");
      return;
    }

    try {
      await apiCreateTask(
        state.currentUser.id,
        title,
        description,
        dataInicial,
        dataLimite,
        status
      );

      taskTitleInput.value = "";
      taskDescriptionInput.value = "";
      taskDataInicialInput.value = "";
      taskDataLimiteInput.value = "";
      taskStatusSelect.value = "pendente";

      setTaskMessage("Tarefa adicionada!", "success");

      await loadAndRenderTasks();
    } catch (err) {
      setTaskMessage(err.message, "error");
    }
  });

  // Estado inicial: tela de login
  showAuthSection();
  switchToLogin();
  setViewMode("list");
});
