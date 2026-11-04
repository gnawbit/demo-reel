const bars = document.getElementById("bars");
const heights = [34, 52, 44, 68, 58, 76, 62, 84, 72, 92, 66, 78, 88, 96];

heights.forEach((height, index) => {
  const bar = document.createElement("div");
  bar.className = "bar";
  bar.style.height = `${height}%`;
  bar.style.animationDelay = `${index * 28}ms`;
  bars.appendChild(bar);
});

const modal = document.getElementById("modal");
const newProjectButton = document.getElementById("new-project");
const closeModalButton = document.getElementById("close-modal");
const createProjectButton = document.getElementById("create-project");
const projectNameInput = document.getElementById("project-name");
const projectGrid = document.getElementById("project-grid");
const toast = document.getElementById("toast");

function openModal() {
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  setTimeout(() => projectNameInput.focus(), 80);
}

function closeModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

newProjectButton.addEventListener("click", openModal);
closeModalButton.addEventListener("click", closeModal);

modal.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModal();
});

document.querySelectorAll(".template").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".template").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
  });
});

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function createProject() {
  const name = projectNameInput.value.trim() || "Untitled project";

  const card = document.createElement("article");
  card.className = "project-card";
  card.innerHTML = `
    <div class="project-icon violet">◈</div>
    <div class="project-name"></div>
    <div class="project-meta">New · 0 tasks left</div>
    <div class="progress"><span style="width: 4%"></span></div>
  `;
  card.querySelector(".project-name").textContent = name;

  projectGrid.prepend(card);
  projectNameInput.value = "";
  closeModal();
  showToast(`“${name}” created`);

  card.animate(
    [
      { transform: "translateY(-8px) scale(.98)", opacity: 0.2 },
      { transform: "translateY(0) scale(1)", opacity: 1 },
    ],
    { duration: 360, easing: "cubic-bezier(.2,.8,.2,1)" },
  );
}

createProjectButton.addEventListener("click", createProject);

projectNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") createProject();
});
