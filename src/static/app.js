document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const messageDiv = document.getElementById("message");
  const adminToggle = document.getElementById("admin-toggle");
  const adminPanel = document.getElementById("admin-panel");
  const adminStatus = document.getElementById("admin-status");
  const showLoginButton = document.getElementById("show-login");
  const logoutButton = document.getElementById("logout-btn");
  const adminLoginForm = document.getElementById("admin-login-form");
  const teacherUsername = document.getElementById("teacher-username");
  const teacherPassword = document.getElementById("teacher-password");

  let teacherToken = localStorage.getItem("teacherToken");
  let currentTeacher = localStorage.getItem("teacherUsername");

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function getAuthHeaders() {
    if (!teacherToken) {
      return {};
    }
    return { "X-Teacher-Token": teacherToken };
  }

  function updateAdminUi() {
    if (teacherToken && currentTeacher) {
      adminStatus.textContent = `Teacher logged in: ${currentTeacher}`;
      logoutButton.classList.remove("hidden");
      showLoginButton.classList.add("hidden");
      adminLoginForm.classList.add("hidden");
    } else {
      adminStatus.textContent = "Viewing as student";
      logoutButton.classList.add("hidden");
      showLoginButton.classList.remove("hidden");
    }
  }

  async function restoreSession() {
    if (!teacherToken) {
      updateAdminUi();
      return;
    }

    try {
      const response = await fetch("/admin/session", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error("Session expired");
      }

      const result = await response.json();
      currentTeacher = result.username;
      localStorage.setItem("teacherUsername", currentTeacher);
    } catch (error) {
      teacherToken = null;
      currentTeacher = null;
      localStorage.removeItem("teacherToken");
      localStorage.removeItem("teacherUsername");
    }

    updateAdminUi();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activity cards and add teacher-only controls.
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        const registerButton = teacherToken
          ? `<button class="register-btn" data-activity="${name}">Register Student</button>`
          : `<button class="register-btn" disabled title="Teacher login required">Register Student</button>`;

        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li>
                        <span class="participant-email">${email}</span>
                        ${
                          teacherToken
                            ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                            : ""
                        }
                      </li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          ${registerButton}
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);
      });

      document.querySelectorAll(".register-btn").forEach((button) => {
        button.addEventListener("click", handleRegister);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function handleRegister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");

    if (!teacherToken) {
      showMessage("Teacher login required for registration.", "error");
      return;
    }

    const email = prompt("Enter student email to register:");
    if (!email) {
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();
      if (response.ok) {
        showMessage(result.message, "success");
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to register student. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    if (!teacherToken) {
      showMessage("Teacher login required for unregister.", "error");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  adminToggle.addEventListener("click", () => {
    adminPanel.classList.toggle("hidden");
  });

  showLoginButton.addEventListener("click", () => {
    adminLoginForm.classList.toggle("hidden");
  });

  adminLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const response = await fetch("/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: teacherUsername.value,
          password: teacherPassword.value,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        teacherToken = result.token;
        currentTeacher = result.username;
        localStorage.setItem("teacherToken", teacherToken);
        localStorage.setItem("teacherUsername", currentTeacher);
        adminLoginForm.reset();
        adminLoginForm.classList.add("hidden");
        updateAdminUi();
        showMessage(`Logged in as ${currentTeacher}`, "success");
        fetchActivities();
      } else {
        showMessage(result.detail || "Login failed", "error");
      }
    } catch (error) {
      showMessage("Login request failed. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  logoutButton.addEventListener("click", async () => {
    if (!teacherToken) {
      return;
    }

    try {
      await fetch("/admin/logout", {
        method: "POST",
        headers: getAuthHeaders(),
      });
    } catch (error) {
      console.error("Error during logout:", error);
    }

    teacherToken = null;
    currentTeacher = null;
    localStorage.removeItem("teacherToken");
    localStorage.removeItem("teacherUsername");
    updateAdminUi();
    showMessage("Logged out", "info");
    fetchActivities();
  });

  // Initialize app
  restoreSession().then(fetchActivities);
});
