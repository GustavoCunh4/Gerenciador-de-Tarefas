// js/app.js

// ----------------------
// Configuração da API
// ----------------------
const API_URL = "http://127.0.0.1:8000";

// ----------------------
// Estado da aplicação
// ----------------------
const state = {
  currentUser: null, // { id, email }
  tasks: []          // array de tarefas vindas da API
};

// ----------------------
// Camada de dados: chamadas à API
// ----------------------

// Helper genérico para tratar respostas
async function handleResponse(response) {
  let data = {};
  try {
    data = await response.json();
  } catch (_) {
    data = {};
  }

  if (!response.ok) {
    const msg = data.detail || "Erro na requisição.";
    throw new Error(msg);
  }

  return data;
}

// Cadastro de usuário (POST /register)
async function apiRegisterUser(email, password) {
  const response = await fetch(`${API_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  return handleResponse(response); // { id, email }
}

// Login (POST /login)
async function apiLoginUser(email, password) {
  const response = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  return handleResponse(response); // { id, email }
}

// Listar tarefas (GET /tasks?user_id=...)
async function apiGetTasks(userId) {
  const response = await fetch(`${API_URL}/tasks?user_id=${userId}`);
  return handleResponse(response); // array de tarefas
}

// Criar tarefa (POST /tasks)
// Agora enviando data_inicial, data_limite e status também
async function apiCreateTask(
  userId,
  title,
  description,
  dataInicial,
  dataLimite,
  status
) {
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

  return handleResponse(response); // tarefa criada
}

// ----------------------
// Inicialização da UI
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

  // Seção TODO
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
    switch (status) {
      case "pendente":
        return "Pendente";
      case "em_andamento":
        return "Em andamento";
      case "concluida":
        return "Concluída";
      default:
        return status;
    }
  }

  // ----------------------
  // Renderização de tarefas
  // ----------------------
  function renderTasks() {
    const tasks = state.tasks || [];
    taskList.innerHTML = "";

    if (!tasks.length) {
      emptyState.style.display = "block";
      return;
    }

    emptyState.style.display = "none";

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

        header.appendChild(titleEl);
        header.appendChild(dateEl);
        li.appendChild(header);

        if (task.description) {
          const descEl = document.createElement("p");
          descEl.className = "task-description";
          descEl.textContent = task.description;
          li.appendChild(descEl);
        }

        // Meta: datas + status
        const metaParts = [];

        if (task.data_inicial) {
          metaParts.push(`Início: ${formatDate(task.data_inicial)}`);
        }
        if (task.data_limite) {
          metaParts.push(`Limite: ${formatDate(task.data_limite)}`);
        }
        if (task.status) {
          metaParts.push(`Status: ${formatStatus(task.status)}`);
        }

        if (metaParts.length) {
          const metaEl = document.createElement("p");
          metaEl.className = "task-meta";
          metaEl.textContent = metaParts.join(" • ");
          li.appendChild(metaEl);
        }

        taskList.appendChild(li);
      });
  }

  async function loadAndRenderTasks() {
    if (!state.currentUser) {
      state.tasks = [];
      renderTasks();
      return;
    }

    try {
      const tasks = await apiGetTasks(state.currentUser.id);
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
  // Eventos de autenticação
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
      state.currentUser = user; // { id, email }
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
      registerMessage.textContent = "Cadastro realizado com sucesso! Você já pode entrar.";
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
    showAuthSection();
    switchToLogin();
  });

  // ----------------------
  // Evento de criação de tarefa
  // ----------------------
  taskForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessages();

    const title = taskTitleInput.value.trim();
    const description = taskDescriptionInput.value.trim();
    const dataInicial = taskDataInicialInput.value || null; // formato YYYY-MM-DD
    const dataLimite = taskDataLimiteInput.value || null;   // formato YYYY-MM-DD
    // const status = taskStatusSelect.value || "pendente";
    const status = "Não Iniciado"

    if (!title) {
      taskMessage.textContent = "O título da tarefa é obrigatório.";
      taskMessage.classList.add("error");
      return;
    }

    if (!state.currentUser) {
      taskMessage.textContent = "Você precisa estar logado para criar tarefas.";
      taskMessage.classList.add("error");
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

      // Limpar campos
      taskTitleInput.value = "";
      taskDescriptionInput.value = "";
      taskDataInicialInput.value = "";
      taskDataLimiteInput.value = "";
      taskStatusSelect.value = "pendente";

      taskMessage.textContent = "Tarefa adicionada!";
      taskMessage.classList.add("success");

      await loadAndRenderTasks();
    } catch (err) {
      taskMessage.textContent = err.message;
      taskMessage.classList.add("error");
    }
  });

  // Estado inicial: tela de login
  showAuthSection();
  switchToLogin();
});
