// js/app.js

// ----------------------
// Estado da aplicação
// ----------------------
const state = {
  currentUser: null, // { email, password }
  users: [],         // array de { email, password }
  tasks: []          // array de { id, userEmail, title, description, createdAt }
};

// ----------------------
// Utilidades de storage
// ----------------------
const STORAGE_KEYS = {
  USERS: "todo_users",
  TASKS: "todo_tasks"
};

function loadStateFromStorage() {
  const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || "[]");
  const tasks = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS) || "[]");
  state.users = users;
  state.tasks = tasks;
}

function saveUsersToStorage() {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(state.users));
}

function saveTasksToStorage() {
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));
}

// ----------------------
// "Camada de dados" (mock da futura API)
// ----------------------

// Cadastro de usuário
function registerUser(email, password) {
  const existing = state.users.find((u) => u.email === email);
  if (existing) {
    throw new Error("Já existe um usuário com esse e-mail.");
  }
  if (password.length < 6) {
    throw new Error("A senha deve ter pelo menos 6 caracteres.");
  }

  const newUser = { email, password };
  state.users.push(newUser);
  saveUsersToStorage();
  return newUser;
}

// Login
function loginUser(email, password) {
  const user = state.users.find((u) => u.email === email && u.password === password);
  if (!user) {
    throw new Error("E-mail ou senha inválidos.");
  }
  state.currentUser = user;
  return user;
}

// Logout
function logoutUser() {
  state.currentUser = null;
}

// Criar tarefa
function createTask(title, description) {
  if (!state.currentUser) {
    throw new Error("Usuário não autenticado.");
  }

  const newTask = {
    id: Date.now(), // simples, suficiente aqui
    userEmail: state.currentUser.email,
    title,
    description: description || "",
    createdAt: new Date().toISOString()
  };

  state.tasks.push(newTask);
  saveTasksToStorage();
  return newTask;
}

// Listar tarefas do usuário logado
function getUserTasks() {
  if (!state.currentUser) return [];
  return state.tasks.filter((t) => t.userEmail === state.currentUser.email);
}

// ----------------------
// UI / DOM
// ----------------------

document.addEventListener("DOMContentLoaded", () => {
  // Carrega estado inicial
  loadStateFromStorage();

  // Elementos principais
  const authSection = document.getElementById("auth-section");
  const todoSection = document.getElementById("todo-section");

  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");

  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");

  const loginMessage = document.getElementById("login-message");
  const registerMessage = document.getElementById("register-message");

  const currentUserEmailEl = document.getElementById("current-user-email");
  const logoutButton = document.getElementById("logout-button");

  const taskForm = document.getElementById("task-form");
  const taskTitleInput = document.getElementById("task-title");
  const taskDescriptionInput = document.getElementById("task-description");
  const taskMessage = document.getElementById("task-message");
  const taskList = document.getElementById("task-list");
  const emptyState = document.getElementById("empty-state");

  // ---- Tabs de Auth ----
  function switchToLogin() {
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
    loginForm.classList.add("active");
    registerForm.classList.remove("active");
    loginMessage.textContent = "";
    registerMessage.textContent = "";
  }

  function switchToRegister() {
    tabRegister.classList.add("active");
    tabLogin.classList.remove("active");
    registerForm.classList.add("active");
    loginForm.classList.remove("active");
    loginMessage.textContent = "";
    registerMessage.textContent = "";
  }

  tabLogin.addEventListener("click", switchToLogin);
  tabRegister.addEventListener("click", switchToRegister);

  // ---- Renderização das tarefas ----
  function renderTasks() {
    const tasks = getUserTasks();
    taskList.innerHTML = "";

    if (!tasks.length) {
      emptyState.style.display = "block";
      return;
    }

    emptyState.style.display = "none";

    tasks
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
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
        const date = new Date(task.createdAt);
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

        taskList.appendChild(li);
      });
  }

  // ---- Estado de login / logout na UI ----

  function showTodoSection() {
    authSection.classList.add("hidden");
    todoSection.classList.remove("hidden");
    currentUserEmailEl.textContent = state.currentUser?.email || "";
    taskMessage.textContent = "";
    renderTasks();
  }

  function showAuthSection() {
    todoSection.classList.add("hidden");
    authSection.classList.remove("hidden");
    taskList.innerHTML = "";
    emptyState.style.display = "block";
    taskTitleInput.value = "";
    taskDescriptionInput.value = "";
  }

  // Se quiser manter login persistente depois, você pode salvar currentUser no storage.
  // Por enquanto, começa sempre deslogado:
  showAuthSection();

  // ---- Handlers de formulário ----

  // Login
  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    loginMessage.textContent = "";
    loginMessage.className = "form-message";

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();

    try {
      loginUser(email, password);
      loginMessage.textContent = "";
      showTodoSection();
    } catch (err) {
      loginMessage.textContent = err.message;
      loginMessage.classList.add("error");
    }
  });

  // Cadastro
  registerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    registerMessage.textContent = "";
    registerMessage.className = "form-message";

    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value.trim();

    try {
      registerUser(email, password);
      registerMessage.textContent = "Cadastro realizado com sucesso! Você já pode entrar.";
      registerMessage.classList.add("success");
      // Opcional: trocar para aba de login automaticamente
      setTimeout(() => {
        switchToLogin();
      }, 800);
    } catch (err) {
      registerMessage.textContent = err.message;
      registerMessage.classList.add("error");
    }
  });

  // Logout
  logoutButton.addEventListener("click", () => {
    logoutUser();
    showAuthSection();
    switchToLogin();
  });

  // Criação de tarefa
  taskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    taskMessage.textContent = "";
    taskMessage.className = "form-message";

    const title = taskTitleInput.value.trim();
    const description = taskDescriptionInput.value.trim();

    if (!title) {
      taskMessage.textContent = "O título da tarefa é obrigatório.";
      taskMessage.classList.add("error");
      return;
    }

    try {
      createTask(title, description);
      taskTitleInput.value = "";
      taskDescriptionInput.value = "";
      taskMessage.textContent = "Tarefa adicionada!";
      taskMessage.classList.add("success");
      renderTasks();
    } catch (err) {
      taskMessage.textContent = err.message;
      taskMessage.classList.add("error");
    }
  });
});
