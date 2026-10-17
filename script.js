(() => {
  "use strict";

  const API_BASE = "http://127.0.0.1:2200";

  const form = document.getElementById("predict-form");
  const submitBtn = document.getElementById("submit-btn");
  const resetBtn = document.getElementById("reset-btn");
  const errorRetryBtn = document.getElementById("error-retry-btn");

  const stateIdle = document.getElementById("state-idle");
  const stateLoading = document.getElementById("state-loading");
  const stateResult = document.getElementById("state-result");
  const stateError = document.getElementById("state-error");

  const scoreNumberEl = document.getElementById("score-number");
  const scoreBandEl = document.getElementById("score-band");
  const scoreContextEl = document.getElementById("score-context");
  const gaugeFill = document.getElementById("gauge-fill");

  // Safely find the error elements.
  // This prevents JavaScript from crashing if an element is missing.
  const errorLabelEl = document.getElementById("error-label");
  const errorCopyEl = document.getElementById("error-copy");

  const GAUGE_ARC_LENGTH = 314;

  // Stop safely if the required HTML elements are missing.
  if (!form || !submitBtn) {
    console.error(
      "Required HTML elements not found. Check index.html."
    );
    return;
  }

  // --------------------------------------------------
  // Draw gauge tick marks
  // --------------------------------------------------

  function drawTicks() {
    document.querySelectorAll(".gauge-ticks").forEach((g) => {
      g.innerHTML = "";

      const cx = 120;
      const cy = 140;
      const rOuter = 100;
      const rInner = 90;

      for (let i = 0; i <= 10; i += 2) {
        const angle = Math.PI - (i / 10) * Math.PI;

        const x1 = cx + rOuter * Math.cos(angle);
        const y1 = cy - rOuter * Math.sin(angle);

        const x2 = cx + rInner * Math.cos(angle);
        const y2 = cy - rInner * Math.sin(angle);

        const line = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line"
        );

        line.setAttribute("x1", x1.toFixed(1));
        line.setAttribute("y1", y1.toFixed(1));
        line.setAttribute("x2", x2.toFixed(1));
        line.setAttribute("y2", y2.toFixed(1));

        g.appendChild(line);
      }
    });
  }

  drawTicks();

  // --------------------------------------------------
  // Stress level buttons
  // --------------------------------------------------

  const segGroup = document.getElementById("stress_level_group");
  const stressHiddenInput = document.getElementById("stress_level");

  if (segGroup && stressHiddenInput) {
    segGroup.querySelectorAll(".seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        segGroup.querySelectorAll(".seg-btn").forEach((b) => {
          b.classList.remove("active");
        });

        btn.classList.add("active");
        stressHiddenInput.value = btn.dataset.value;

        clearFieldError(stressHiddenInput);
      });
    });
  }

  // --------------------------------------------------
  // Field error helpers
  // --------------------------------------------------

  function setFieldError(input, message) {
    if (!input) return;

    const wrap = input.closest(".field");

    if (!wrap) return;

    wrap.classList.add("field-error");

    const msgEl = wrap.querySelector(".error-msg");

    if (msgEl) {
      msgEl.textContent = message;
    }
  }

  function clearFieldError(input) {
    if (!input) return;

    const wrap = input.closest(".field");

    if (!wrap) return;

    wrap.classList.remove("field-error");

    const msgEl = wrap.querySelector(".error-msg");

    if (msgEl) {
      msgEl.textContent = "";
    }
  }

  function clearAllErrors() {
    form.querySelectorAll(".field").forEach((field) => {
      field.classList.remove("field-error");
    });

    form.querySelectorAll(".error-msg").forEach((message) => {
      message.textContent = "";
    });
  }

  // --------------------------------------------------
  // Collect form values
  // --------------------------------------------------

  function collectPayload() {
    const fd = new FormData(form);

    function getNumber(name, parser) {
      const value = fd.get(name);

      if (value === null || String(value).trim() === "") {
        return NaN;
      }

      return parser(value);
    }

    return {
      age: getNumber("age", (v) => Number(v)),
      gender: fd.get("gender") || "",
      country: (fd.get("country") || "").trim(),
      academic_level: fd.get("academic_level") || "",
      most_used_platform: fd.get("most_used_platform") || "",
      purpose_of_use: fd.get("purpose_of_use") || "",

      avg_daily_usage_hours: getNumber(
        "avg_daily_usage_hours",
        parseFloat
      ),

      daily_unlocks: getNumber(
        "daily_unlocks",
        (v) => Number(v)
      ),

      study_hours: getNumber("study_hours", parseFloat),

      physical_activity_hours: getNumber(
        "physical_activity_hours",
        parseFloat
      ),

      sleep_hours_per_night: getNumber(
        "sleep_hours_per_night",
        parseFloat
      ),

      stress_level: fd.get("stress_level") || ""
    };
  }

  // --------------------------------------------------
  // Client-side validation
  // --------------------------------------------------

  function validate(payload) {
    const errors = [];

    const numericChecks = [
      ["age", 10, 100],
      ["avg_daily_usage_hours", 0, 24],
      ["daily_unlocks", 0, Infinity],
      ["study_hours", 0, 24],
      ["physical_activity_hours", 0, 24],
      ["sleep_hours_per_night", 0, 24]
    ];

    numericChecks.forEach(([key, min, max]) => {
      const input = document.getElementById(key);
      const value = payload[key];

      if (!Number.isFinite(value)) {
        errors.push([input, "Enter a valid number."]);
      } else if (value < min || value > max) {
        errors.push([
          input,
          `Value must be between ${min} and ${
            max === Infinity ? "a valid non-negative number" : max
          }.`
        ]);
      }
    });

    const requiredFields = [
      "gender",
      "country",
      "academic_level",
      "most_used_platform",
      "purpose_of_use"
    ];

    requiredFields.forEach((key) => {
      const input = document.getElementById(key);

      if (!payload[key] || !String(payload[key]).trim()) {
        errors.push([input, "This field is required."]);
      }
    });

    if (!payload.stress_level) {
      errors.push([
        document.getElementById("stress_level"),
        "Please select a stress level."
      ]);
    }

    return errors;
  }

  // --------------------------------------------------
  // Show the appropriate result panel
  // --------------------------------------------------

  function showState(name) {
    const states = {
      idle: stateIdle,
      loading: stateLoading,
      result: stateResult,
      error: stateError
    };

    Object.values(states).forEach((element) => {
      if (element) {
        element.hidden = true;
      }
    });

    if (states[name]) {
      states[name].hidden = false;
    }
  }

  function setSubmitting(isSubmitting) {
    submitBtn.disabled = isSubmitting;
    submitBtn.classList.toggle("loading", isSubmitting);
  }

  // --------------------------------------------------
  // Display an error safely
  // --------------------------------------------------

  function renderError(label, message) {
    if (errorLabelEl) {
      errorLabelEl.textContent = label;
    }

    if (errorCopyEl) {
      errorCopyEl.textContent = message;
    }

    if (stateError) {
      showState("error");
    } else {
      console.error(label + ": " + message);
      alert(label + "\n" + message);
    }
  }

  // --------------------------------------------------
  // Display the prediction result
  // --------------------------------------------------

  function bandFor(score) {
    if (score < 4) {
      return {
        label: "Signal: strained",
        context:
          "Your responses suggest elevated strain right now. " +
          "Small shifts in sleep or screen time can go a long way."
      };
    }

    if (score < 7) {
      return {
        label: "Signal: balanced",
        context:
          "Your rhythm looks fairly steady, with some room to recover and reset."
      };
    }

    return {
      label: "Signal: strong",
      context:
        "Your habits point to a well-supported baseline. Keep it up."
    };
  }

  function renderResult(score) {
    const clamped = Math.max(0, Math.min(10, score));
    const result = bandFor(clamped);

    if (scoreNumberEl) {
      scoreNumberEl.textContent = score.toFixed(2);
    }

    if (scoreBandEl) {
      scoreBandEl.textContent = result.label;
    }

    if (scoreContextEl) {
      scoreContextEl.textContent = result.context;
    }

    if (gaugeFill) {
      gaugeFill.style.transition = "none";
      gaugeFill.style.strokeDashoffset = String(GAUGE_ARC_LENGTH);

      requestAnimationFrame(() => {
        gaugeFill.style.transition = "";

        const offset = GAUGE_ARC_LENGTH * (1 - clamped / 10);

        gaugeFill.style.strokeDashoffset = String(offset);
      });
    }

    showState("result");
  }

  // --------------------------------------------------
  // Map backend validation errors to form fields
  // --------------------------------------------------

  function applyServerValidationErrors(detail) {
    if (!Array.isArray(detail)) {
      return false;
    }

    const fieldMap = {
      Age: "age",
      Gender: "gender",
      Country: "country",
      Academic_Level: "academic_level",
      Most_Used_Platform: "most_used_platform",
      Purpose_Of_Use: "purpose_of_use",
      Avg_Daily_Usage_Hours: "avg_daily_usage_hours",
      Daily_Unlocks: "daily_unlocks",
      Study_Hours: "study_hours",
      Physical_Activity_Hours: "physical_activity_hours",
      Sleep_Hours_Per_Night: "sleep_hours_per_night",
      Stress_Level: "stress_level"
    };

    let matched = false;

    detail.forEach((error) => {
      const field = Array.isArray(error.loc)
        ? error.loc[error.loc.length - 1]
        : null;

      const inputId = fieldMap[field] || field;
      const input = inputId
        ? document.getElementById(inputId)
        : null;

      if (input) {
        setFieldError(input, error.msg || "Invalid value.");
        matched = true;
      }

      console.error("API validation error:", error);
    });

    return matched;
  }

  // --------------------------------------------------
  // Submit form and call FastAPI
  // --------------------------------------------------

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    clearAllErrors();

    const payload = collectPayload();
    const clientErrors = validate(payload);

    if (clientErrors.length > 0) {
      clientErrors.forEach(([input, message]) => {
        setFieldError(input, message);
      });

      clientErrors[0][0]?.focus?.();

      return;
    }

    setSubmitting(true);
    showState("loading");

    // Convert frontend field names to backend field names.
    const requestData = {
      Age: payload.age,
      Gender: payload.gender,
      Country: payload.country,
      Academic_Level: payload.academic_level,
      Most_Used_Platform: payload.most_used_platform,
      Purpose_Of_Use: payload.purpose_of_use,
      Avg_Daily_Usage_Hours: payload.avg_daily_usage_hours,
      Daily_Unlocks: payload.daily_unlocks,
      Study_Hours: payload.study_hours,
      Physical_Activity_Hours: payload.physical_activity_hours,
      Sleep_Hours_Per_Night: payload.sleep_hours_per_night,
      Stress_Level: payload.stress_level
    };

    console.log("Sending prediction request:", requestData);

    try {
      const response = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestData)
      });

      const responseText = await response.text();

      let data;

      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = { detail: responseText };
      }

      console.log("Prediction API status:", response.status);
      console.log("Prediction API response:", data);

      if (response.status === 422) {
        const matched = applyServerValidationErrors(data.detail);

        const details = Array.isArray(data.detail)
          ? data.detail
              .map((error) => {
                const field = Array.isArray(error.loc)
                  ? error.loc.join(" → ")
                  : "Input";

                return `${field}: ${error.msg || "Invalid value"}`;
              })
              .join("\n")
          : typeof data.detail === "string"
            ? data.detail
            : "The submitted data did not match the API requirements.";

        renderError(
          "Check your inputs",
          matched
            ? "Please correct the highlighted fields."
            : details
        );

        return;
      }

      if (!response.ok) {
        const message =
          typeof data.detail === "string"
            ? data.detail
            : JSON.stringify(data.detail || data);

        renderError(
          `Prediction failed (${response.status})`,
          message
        );

        return;
      }

      const score = data.predicted_mental_health_score;

      if (
        typeof score !== "number" ||
        !Number.isFinite(score)
      ) {
        renderError(
          "Unexpected response",
          "The API responded, but a valid prediction score was not found."
        );

        return;
      }

      renderResult(score);

    } catch (error) {
      console.error("Prediction request failed:", error);

      renderError(
        "Can't reach the server",
        "Please check that FastAPI is running at " + API_BASE +
        " and try again."
      );

    } finally {
      setSubmitting(false);
    }
  });

  // --------------------------------------------------
  // Clear field errors while editing
  // --------------------------------------------------

  form.querySelectorAll("input, select").forEach((element) => {
    element.addEventListener("input", () => {
      clearFieldError(element);
    });

    element.addEventListener("change", () => {
      clearFieldError(element);
    });
  });

  // --------------------------------------------------
  // Reset and retry buttons
  // --------------------------------------------------

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      form.reset();
      clearAllErrors();

      if (segGroup) {
        segGroup.querySelectorAll(".seg-btn").forEach((button) => {
          button.classList.remove("active");
        });
      }

      if (stressHiddenInput) {
        stressHiddenInput.value = "";
      }

      showState("idle");
    });
  }

  if (errorRetryBtn) {
    errorRetryBtn.addEventListener("click", () => {
      showState("idle");
    });
  }

})();