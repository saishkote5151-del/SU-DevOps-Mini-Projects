const API_URL = "http://127.0.0.1:5000/api";

let books = [];
let members = [];
let loans = [];
let currentAction = "book";

const loginScreen = document.getElementById("loginScreen");
const loginForm = document.getElementById("loginForm");
const logoutBtn = document.getElementById("logoutBtn");
const welcomeText = document.getElementById("welcomeText");
const searchInput = document.getElementById("searchInput");
const bookList = document.getElementById("bookList");
const dashboardPage = document.getElementById("dashboardPage");
const pageContent = document.getElementById("pageContent");

const addBookBtn = document.getElementById("addBookBtn");
const issueBookBtn = document.getElementById("issueBookBtn");

const recordDialog = document.getElementById("recordDialog");
const closeDialog = document.getElementById("closeDialog");
const recordForm = document.getElementById("recordForm");

const dialogLabel = document.getElementById("dialogLabel");
const dialogTitle = document.getElementById("dialogTitle");
const firstFieldLabel = document.getElementById("firstFieldLabel");
const secondFieldLabel = document.getElementById("secondFieldLabel");

const firstField = document.getElementById("firstField");
const secondField = document.getElementById("secondField");
const statusField = document.getElementById("statusField");

const bookSelectGroup = document.getElementById("bookSelectGroup");
const memberSelectGroup = document.getElementById("memberSelectGroup");
const bookSelect = document.getElementById("bookSelect");
const memberSelect = document.getElementById("memberSelect");


function getInitials(name) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}


function getStatusClass(status) {
  if (status === "On loan") return "loan";
  if (status === "Overdue") return "overdue";

  return "";
}


function canManageLibrary() {
  const session = JSON.parse(localStorage.getItem("bibliosSession"));

  return (
    session &&
    (session.role === "Librarian" || session.role === "Administrator")
  );
}


function applyRoleAccess() {
  document.querySelectorAll(".librarian-only").forEach((element) => {
    element.style.display = canManageLibrary() ? "" : "none";
  });
}


async function loadBooksFromBackend() {
  try {
    const response = await fetch(`${API_URL}/books`);

    if (!response.ok) {
      throw new Error("Books could not be loaded");
    }

    books = await response.json();
    renderBooks(searchInput.value);
  } catch (error) {
    console.log("Backend connection failed:", error);

    bookList.innerHTML = `
      <p class="date" style="padding: 20px 0;">
        Backend is not running. Run: python app.py
      </p>
    `;
  }
}


async function loadMembersFromBackend() {
  try {
    const response = await fetch(`${API_URL}/members`);

    if (!response.ok) {
      throw new Error("Members could not be loaded");
    }

    members = await response.json();
  } catch (error) {
    console.log("Members could not be loaded:", error);
  }
}


async function loadLoansFromBackend() {
  try {
    const response = await fetch(`${API_URL}/loans`);

    if (!response.ok) {
      throw new Error("Loans could not be loaded");
    }

    loans = await response.json();
  } catch (error) {
    console.log("Loans could not be loaded:", error);
  }
}


async function loadDashboardFromBackend() {
  try {
    const response = await fetch(`${API_URL}/dashboard`);

    if (!response.ok) {
      throw new Error("Dashboard could not be loaded");
    }

    const data = await response.json();

    document.getElementById("totalBooks").textContent =
      data.total_books.toLocaleString();

    document.getElementById("totalMembers").textContent =
      data.total_members.toLocaleString();

    const statNumbers = document.querySelectorAll(".stat-card strong");

    statNumbers[2].textContent = data.active_loans;
    statNumbers[3].textContent = data.overdue_books;
  } catch (error) {
    console.log("Dashboard data not loaded:", error);
  }
}


function renderBooks(filter = "") {
  const search = filter.toLowerCase();

  const matchingBooks = books.filter((book) => {
    return (
      book.title.toLowerCase().includes(search) ||
      book.author.toLowerCase().includes(search)
    );
  });

  if (matchingBooks.length === 0) {
    bookList.innerHTML = `
      <p class="date" style="padding: 20px 0;">No books found.</p>
    `;

    return;
  }

  bookList.innerHTML = matchingBooks
    .map(
      (book, index) => `
        <article class="book-row">
          <div class="book-cover">
            ${String(index + 1).padStart(2, "0")}
          </div>

          <div>
            <strong>${book.title}</strong>
            <small>${book.author}</small>
          </div>

          <span class="tag ${getStatusClass(book.status)}">
            ${book.status.toUpperCase()}
          </span>
        </article>
      `
    )
    .join("");
}


function fillLoanDropdowns() {
  const availableBooks = books.filter((book) => {
    return book.status === "Available";
  });

  bookSelect.innerHTML =
    `<option value="">Select an available book</option>` +
    availableBooks
      .map((book) => {
        return `
          <option value="${book.id}">
            ${book.title} — ${book.author}
          </option>
        `;
      })
      .join("");

  memberSelect.innerHTML =
    `<option value="">Select a registered member</option>` +
    members
      .map((member) => {
        return `
          <option value="${member.id}">
            ${member.name} (${member.role})
          </option>
        `;
      })
      .join("");
}


async function openDialog(action) {
  currentAction = action;

  firstField.value = "";
  secondField.value = "";
  statusField.value = "Available";

  firstField.parentElement.style.display = "grid";
  secondField.parentElement.style.display = "grid";
  statusField.parentElement.style.display = "grid";

  bookSelectGroup.classList.add("hidden");
  memberSelectGroup.classList.add("hidden");

  firstField.required = true;
  secondField.required = true;
  bookSelect.required = false;
  memberSelect.required = false;

  if (action === "book") {
    dialogLabel.textContent = "NEW BOOK";
    dialogTitle.textContent = "Add a book";
    firstFieldLabel.textContent = "Book title";
    secondFieldLabel.textContent = "Author";
  }

  if (action === "member") {
    dialogLabel.textContent = "NEW MEMBER";
    dialogTitle.textContent = "Register a member";
    firstFieldLabel.textContent = "Member name";
    secondFieldLabel.textContent = "Role";
    secondField.placeholder = "Student, Teacher, etc.";

    statusField.parentElement.style.display = "none";
  }

  if (action === "loan") {
    dialogLabel.textContent = "ISSUE BOOK";
    dialogTitle.textContent = "Issue a book";

    firstField.parentElement.style.display = "none";
    secondField.parentElement.style.display = "none";
    statusField.parentElement.style.display = "none";

    firstField.required = false;
    secondField.required = false;

    bookSelectGroup.classList.remove("hidden");
    memberSelectGroup.classList.remove("hidden");

    bookSelect.required = true;
    memberSelect.required = true;

    await loadBooksFromBackend();
    await loadMembersFromBackend();
    fillLoanDropdowns();
  }

  recordDialog.showModal();
}


function showPage(title, content) {
  dashboardPage.classList.add("hidden");
  pageContent.classList.remove("hidden");

  pageContent.innerHTML = `
    <p class="date">BIBLIOS LIBRARY</p>
    <h2>${title}<span>.</span></h2>
    <div style="margin-top: 22px;">${content}</div>
  `;
}


function showCatalogue() {
  showPage(
    "Catalogue",
    `
      <label class="search-box" style="width: 100%; max-width: 450px;">
        ⌕
        <input id="catalogueSearch" placeholder="Search catalogue">
      </label>

      <div id="catalogueList" style="margin-top: 18px;"></div>
    `
  );

  const catalogueList = document.getElementById("catalogueList");
  const catalogueSearch = document.getElementById("catalogueSearch");

  function renderCatalogue(search = "") {
    const matchingBooks = books.filter((book) => {
      return (
        book.title.toLowerCase().includes(search.toLowerCase()) ||
        book.author.toLowerCase().includes(search.toLowerCase())
      );
    });

    catalogueList.innerHTML =
      matchingBooks
        .map(
          (book, index) => `
            <article class="book-row">
              <div class="book-cover">${index + 1}</div>

              <div>
                <strong>${book.title}</strong>
                <small>${book.author}</small>
              </div>

              <span class="tag ${getStatusClass(book.status)}">
                ${book.status.toUpperCase()}
              </span>
            </article>
          `
        )
        .join("") || `<p class="date">No books found.</p>`;
  }

  renderCatalogue();

  catalogueSearch.addEventListener("input", (event) => {
    renderCatalogue(event.target.value);
  });
}


async function showMembers() {
  showPage(
    "Members",
    `
      <button class="primary-button librarian-only" id="registerMemberBtn">
        ＋ Register member
      </button>

      <div id="membersList" style="margin-top: 18px;"></div>
    `
  );

  await loadMembersFromBackend();

  const membersList = document.getElementById("membersList");

  membersList.innerHTML =
    members
      .map(
        (member) => `
          <article class="member-row">
            <div class="member-avatar">${getInitials(member.name)}</div>

            <div>
              <strong>${member.name}</strong>
              <small>${member.role}</small>
            </div>

            <span class="tag">ACTIVE</span>
          </article>
        `
      )
      .join("") || `<p class="date">No members registered.</p>`;

  document
    .getElementById("registerMemberBtn")
    ?.addEventListener("click", () => openDialog("member"));

  applyRoleAccess();
}


async function showLoans() {
  showPage(
    "Loans and Returns",
    `
      <button class="primary-button librarian-only" id="newLoanBtn">
        ↔️ Issue a book
      </button>

      <div id="loanList" style="margin-top: 18px;"></div>
    `
  );

  await loadLoansFromBackend();

  const loanList = document.getElementById("loanList");

  loanList.innerHTML =
    loans
      .map(
        (loan, index) => `
          <article class="book-row">
            <div class="book-cover">${index + 1}</div>

            <div>
              <strong>${loan.book_title}</strong>
              <small>
                ${loan.member_name} · Due: ${loan.due_date}
              </small>
            </div>

            <button class="tag loan return-book" data-id="${loan.id}">
              RETURN
            </button>
          </article>
        `
      )
      .join("") || `<p class="date">No active loans.</p>`;

  document.querySelectorAll(".return-book").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const response = await fetch(
          `${API_URL}/loans/${button.dataset.id}/return`,
          { method: "PUT" }
        );

        const result = await response.json();

        if (!response.ok) {
          alert(result.error || "Book could not be returned");
          return;
        }

        alert("Book returned successfully!");

        await loadBooksFromBackend();
        await loadDashboardFromBackend();
        showLoans();
      } catch (error) {
        alert("Backend is not running. Run: python app.py");
      }
    });
  });

  document
    .getElementById("newLoanBtn")
    ?.addEventListener("click", () => openDialog("loan"));

  applyRoleAccess();
}


function showDevOps() {
  showPage(
    "DevOps Control",
    `
      <div class="pipeline">
        <div class="pipeline-stage">
          <i></i><strong>GitHub</strong><small>main branch</small>
        </div>

        <div class="pipeline-stage">
          <i></i><strong>CI Tests</strong><small>passed</small>
        </div>

        <div class="pipeline-stage">
          <i></i><strong>Docker</strong><small>image ready</small>
        </div>

        <div class="pipeline-stage">
          <i></i><strong>Minikube</strong><small>3 pods running</small>
        </div>
      </div>
    `
  );
}


function showDashboard() {
  dashboardPage.classList.remove("hidden");
  pageContent.classList.add("hidden");
}


function setSession(user) {
  loginScreen.style.display = "none";
  welcomeText.innerHTML = `Welcome, ${user.name}<span>.</span>`;

  applyRoleAccess();
}


loginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const role = document.getElementById("role").value;

  const name = email
    .split("@")[0]
    .split(/[._-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const user = { name, role };

  localStorage.setItem("bibliosSession", JSON.stringify(user));
  setSession(user);
});


logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("bibliosSession");
  window.location.reload();
});


searchInput.addEventListener("input", (event) => {
  renderBooks(event.target.value);
});


addBookBtn.addEventListener("click", () => openDialog("book"));
issueBookBtn.addEventListener("click", () => openDialog("loan"));


document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    openDialog(button.dataset.action);
  });
});


closeDialog.addEventListener("click", () => recordDialog.close());


recordForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    if (currentAction === "book") {
      const response = await fetch(`${API_URL}/books`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: firstField.value.trim(),
          author: secondField.value.trim(),
          status: statusField.value
        })
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || "Book could not be added");
        return;
      }

      alert("Book added successfully!");
    }

    if (currentAction === "member") {
      const response = await fetch(`${API_URL}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: firstField.value.trim(),
          role: secondField.value.trim()
        })
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || "Member could not be registered");
        return;
      }

      alert("Member registered successfully!");
    }

    if (currentAction === "loan") {
      const response = await fetch(`${API_URL}/loans`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          book_id: Number(bookSelect.value),
          member_id: Number(memberSelect.value)
        })
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || "Book could not be issued");
        return;
      }

      alert(`Book issued successfully! Due: ${result.due_date}`);
    }

    recordForm.reset();
    recordDialog.close();

    await loadBooksFromBackend();
    await loadMembersFromBackend();
    await loadLoansFromBackend();
    await loadDashboardFromBackend();
  } catch (error) {
    alert("Backend is not running. Run: python app.py");
  }
});


document
  .getElementById("catalogueBtn")
  .addEventListener("click", showCatalogue);


document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector(".nav-item.active")?.classList.remove("active");
    button.classList.add("active");

    if (button.dataset.page === "dashboard") showDashboard();
    if (button.dataset.page === "catalogue") showCatalogue();
    if (button.dataset.page === "members") showMembers();
    if (button.dataset.page === "loans") showLoans();
    if (button.dataset.page === "devops") showDevOps();
  });
});


const savedSession = JSON.parse(localStorage.getItem("bibliosSession"));

if (savedSession) {
  setSession(savedSession);
}

loadBooksFromBackend();
loadMembersFromBackend();
loadLoansFromBackend();
loadDashboardFromBackend();
