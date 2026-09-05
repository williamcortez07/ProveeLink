/**
 * @file auth.js
 * @description Módulo principal de autenticación.
 * Responsabilidades: renderizado de vistas, validación de inputs,
 * orquestación del flujo Login → Register → OTP → Home.
 */

import {
  loginService,
  registerService,
  refreshTokenService,
  verifyOtpService,
  resendOtpService,
} from "./services/authService.js";

import { notify } from "./services/notificationService.js";
import { Router } from "./services/routes.js";
/**
 * @namespace SessionManager
 * Gestiona el ciclo de vida de tokens y temporizadores.
 *
 * CONTROL DE MEMORY LEAKS:
 * - _refreshIntervalId: ID del setInterval del silent refresh (2h).
 *   Se limpia con clearInterval() antes de crear uno nuevo o al cerrar sesión.
 * - _otpTimerId: ID del setInterval de la cuenta regresiva OTP (15min).
 *   Se limpia con clearInterval() al cerrar el modal, al verificar con éxito
 *   o al solicitar un nuevo código, evitando que múltiples timers corran en paralelo.
 */
const SessionManager = {
  _refreshIntervalId: null,
  _otpTimerId: null,

  saveSession(data) {
    console.log(
      "[SessionManager Debug] Guardando sesión. Datos recibidos:",
      data,
    );
    if (!data) {
      console.warn("[SessionManager Debug] No se recibieron datos.");
      return;
    }
    const token =
      data.accessToken ||
      data.data?.accessToken ||
      data.token ||
      data.data?.token;
    const refresh =
      data.refreshToken ||
      data.data?.refreshToken ||
      data.tokenRefreshed ||
      data.data?.tokenRefreshed;

    if (token) {
      localStorage.setItem("accessToken", token);
      console.log(
        "[SessionManager Debug] 'accessToken' guardado en localStorage:",
        token.substring(0, 15) + "...",
      );
    } else {
      console.warn(
        "[SessionManager Debug] No se pudo extraer 'accessToken' de la respuesta del servidor.",
      );
    }

    if (refresh) {
      localStorage.setItem("refreshToken", refresh);
      console.log(
        "[SessionManager Debug] 'refreshToken' guardado en localStorage:",
        refresh.substring(0, 15) + "...",
      );
    } else {
      console.log(
        "[SessionManager Debug] No se detectó 'refreshToken' en la respuesta.",
      );
    }
  },

  clearSession() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    this.stopSilentRefresh();
    this.stopOtpTimer();
  },

  /**
   * Inicia el mecanismo de Silent Refresh cada 2 horas.
   * Cancela cualquier intervalo previo para evitar duplicados (memory leak).
   */
  startSilentRefresh() {
    this.stopSilentRefresh(); // garantiza un único intervalo activo
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    this._refreshIntervalId = setInterval(async () => {
      try {
        const res = await refreshTokenService();
        const token =
          res.accessToken ||
          res.data?.accessToken ||
          res.token ||
          res.data?.token;
        if (token) {
          localStorage.setItem("accessToken", token);
          console.info("[Auth] Token renovado silenciosamente.");
        } else {
          console.warn(
            "[Auth] La renovación retornó una respuesta sin token válido.",
          );
        }
      } catch (err) {
        console.warn("[Auth] Silent refresh fallido:", err.message);
        notify.warning("Tu sesión expiró. Por favor inicia sesión de nuevo.");
        this.clearSession();
        AuthManager.renderLogin();
      }
    }, TWO_HOURS_MS);
  },

  /** Detiene el intervalo de silent refresh. */
  stopSilentRefresh() {
    if (this._refreshIntervalId !== null) {
      clearInterval(this._refreshIntervalId);
      this._refreshIntervalId = null;
    }
  },

  /**
   * Inicia la cuenta regresiva del OTP.
   * @param {number} totalSeconds - Segundos totales (default: 15 * 60).
   * @param {Function} onTick     - Callback({ minutes, seconds, expired }).
   */
  startOtpTimer(totalSeconds = 15 * 60, onTick) {
    this.stopOtpTimer(); // cancela timer previo antes de iniciar uno nuevo
    let remaining = totalSeconds;
    onTick({
      minutes: Math.floor(remaining / 60),
      seconds: remaining % 60,
      expired: false,
    });

    this._otpTimerId = setInterval(() => {
      remaining -= 1;
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      const expired = remaining <= 0;
      onTick({ minutes, seconds, expired });
      if (expired) this.stopOtpTimer();
    }, 1000);
  },

  /** Detiene y limpia el intervalo del timer OTP. */
  stopOtpTimer() {
    if (this._otpTimerId !== null) {
      clearInterval(this._otpTimerId);
      this._otpTimerId = null;
    }
  },
};

const Validators = {
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v),
  password: (v) =>
    /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/.test(
      v,
    ),
};

const AuthTemplates = {
  login: () => `
    <div class="login-container">
      <div class="login-header">
        <div class="logo"><span class="logo-provee">Provee</span><span class="logo-link">Link</span></div>
        <p class="slogan">Conectamos proveedores, impulsamos <span class="accent-text">oportunidades.</span></p>
        <h2 class="welcome-title">¡Bienvenido de nuevo!</h2>
        <p class="welcome-subtitle">Inicia sesión para continuar</p>
      </div>

      <form class="login-form" id="loginForm" novalidate>
        <div class="input-card" id="card-email">
          <div class="input-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div class="input-field-wrapper">
            <label for="email">Correo electrónico</label>
            <input type="email" id="email" placeholder="ejemplo@proveelink.com" autocomplete="email" required>
          </div>
        </div>
        <p class="field-error" id="error-email"></p>

        <div class="input-card" id="card-password">
          <div class="input-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div class="input-field-wrapper">
            <label for="password">Contraseña</label>
            <input type="password" id="password" placeholder="Ingresa tu contraseña" autocomplete="current-password" required>
          </div>
          <button type="button" class="toggle-password" id="togglePassword" aria-label="Mostrar u ocultar contraseña">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>

        <div class="form-options">
          <label class="remember-me">
            <input type="checkbox" id="remember">
            <span class="custom-checkbox"></span>Recordarme
          </label>
          <a href="#" class="forgot-password">¿Olvidaste tu contraseña?</a>
        </div>

        <button type="submit" class="btn-submit" id="loginSubmit">
          <span>Iniciar sesión</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      </form>

      <div class="login-footer">
        <p>¿No tienes una cuenta? <a href="#" id="linkToRegister" class="register-link">Regístrate</a></p>
      </div>
      <div class="bottom-wave">
        <svg viewBox="0 0 1440 320" preserveAspectRatio="none"><path fill="#0d2c54" d="M0,224L120,240C240,256,480,288,720,288C960,288,1200,256,1320,240L1440,224L1440,320L1320,320C1200,320,960,320,720,320C480,320,240,320,120,320L0,320Z"/></svg>
      </div>
    </div>
  `,

  register: () => `
    <div class="login-container">
      <div class="login-header">
        <div class="logo"><span class="logo-provee">Provee</span><span class="logo-link">Link</span></div>
        <p class="slogan">Conectamos proveedores, impulsamos <span class="accent-text">oportunidades.</span></p>
        <h2 class="welcome-title">Crea tu cuenta</h2>
        <p class="welcome-subtitle">Regístrate para empezar</p>
      </div>

      <form class="login-form" id="registerForm" novalidate>
        <div class="input-card" id="card-regEmail">
          <div class="input-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div class="input-field-wrapper">
            <label for="regEmail">Correo electrónico</label>
            <input type="email" id="regEmail" placeholder="ejemplo@proveelink.com" autocomplete="email" required>
          </div>
        </div>
        <p class="field-error" id="error-regEmail"></p>

        <div class="input-card" id="card-regPassword">
          <div class="input-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div class="input-field-wrapper">
            <label for="regPassword">Contraseña</label>
            <input type="password" id="regPassword" placeholder="Mín. 8 chars, 1 mayúscula, 1 número, 1 símbolo" autocomplete="new-password" required>
          </div>
        </div>
        <p class="field-error" id="error-regPassword"></p>

        <button type="submit" class="btn-submit" id="registerSubmit">
          <span>Registrarse</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      </form>

      <div class="login-footer">
        <p>¿Ya tienes una cuenta? <a href="#" id="linkToLogin" class="register-link">Inicia sesión</a></p>
      </div>
      <div class="bottom-wave">
        <svg viewBox="0 0 1440 320" preserveAspectRatio="none"><path fill="#0d2c54" d="M0,224L120,240C240,256,480,288,720,288C960,288,1200,256,1320,240L1440,224L1440,320L1320,320C1200,320,960,320,720,320C480,320,240,320,120,320L0,320Z"/></svg>
      </div>
    </div>
  `,
};

const OtpModal = {
  _email: null,
  _isLocked: false,
  _boundEscapeHandler: null,

  /**
   * Abre el modal OTP para el email indicado e inicia el timer de 15 minutos.
   * @param {string} email - Correo del usuario recién registrado.
   */
  open(email) {
    this._email = email;
    this._isLocked = true;
    this._injectModal();
    this._bindEvents();
    this._setLockedState(true);
    SessionManager.startOtpTimer(15 * 60, ({ minutes, seconds, expired }) => {
      this._updateTimer(minutes, seconds, expired);
    });
  },

  /** Cierra y limpia el modal, detiene el timer OTP. */
  close() {
    if (this._isLocked) return;

    document.removeEventListener("keydown", this._boundEscapeHandler);
    this._boundEscapeHandler = null;
    SessionManager.stopOtpTimer();
    const overlay = document.getElementById("otpModalOverlay");
    if (overlay) {
      overlay.classList.add("otp-modal--leaving");
      overlay.addEventListener("animationend", () => overlay.remove(), {
        once: true,
      });
    }
  },

  /** Inyecta el HTML del modal en el body. */
  _injectModal() {
    // Evita duplicados
    document.getElementById("otpModalOverlay")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "otpModalOverlay";
    overlay.className = "otp-overlay";
    overlay.innerHTML = `
      <div class="otp-modal" role="dialog" aria-modal="true" aria-labelledby="otpModalTitle">
        <div class="otp-modal__header">
          <div class="otp-modal__icon-wrap">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          </div>
          <h2 class="otp-modal__title" id="otpModalTitle">Verifica tu correo</h2>
          <p class="otp-modal__subtitle">Ingresa el código de 6 dígitos enviado a <strong>${this._email}</strong></p>
        </div>

        <div class="otp-inputs-wrap" id="otpInputsWrap">
          ${Array.from(
            { length: 6 },
            (_, i) =>
              `<input class="otp-input" id="otp-${i}" type="text" inputmode="numeric"
             pattern="[0-9]*" maxlength="1" aria-label="Dígito ${i + 1} del código OTP"
             autocomplete="one-time-code">`,
          ).join("")}
        </div>

        <div class="otp-timer-wrap" id="otpTimerWrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span id="otpTimerDisplay">15:00</span>
        </div>

        <p class="otp-error-msg" id="otpErrorMsg"></p>

        <button class="btn-submit otp-verify-btn" id="otpVerifyBtn">
          <span>Verificar código</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </button>

        <button class="btn-resend" id="otpResendBtn" disabled>
          Solicitar nuevo código
        </button>

        <button class="otp-modal__close" id="otpCloseBtn" aria-label="Cerrar modal">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `;
    document.body.appendChild(overlay);

    // Foco al primer input tras la animación
    setTimeout(() => document.getElementById("otp-0")?.focus(), 350);
  },

  /** Enlaza todos los eventos internos del modal. */
  _bindEvents() {
    if (this._boundEscapeHandler) {
      document.removeEventListener("keydown", this._boundEscapeHandler);
    }

    this._boundEscapeHandler = (e) => {
      if (e.key === "Escape" && this._isLocked) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("keydown", this._boundEscapeHandler);

    // Navegación automática entre inputs
    for (let i = 0; i < 6; i++) {
      const input = document.getElementById(`otp-${i}`);
      if (!input) continue;

      input.addEventListener("input", (e) => {
        const val = e.target.value.replace(/\D/g, "");
        e.target.value = val.slice(0, 1);
        this._clearError();
        if (val && i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !e.target.value && i > 0) {
          document.getElementById(`otp-${i - 1}`)?.focus();
        }
      });

      input.addEventListener("paste", (e) => {
        e.preventDefault();
        const pasted = e.clipboardData
          .getData("text")
          .replace(/\D/g, "")
          .slice(0, 6);
        [...pasted].forEach((char, idx) => {
          const t = document.getElementById(`otp-${idx}`);
          if (t) t.value = char;
        });
        document.getElementById(`otp-${Math.min(pasted.length, 5)}`)?.focus();
      });
    }

    document
      .getElementById("otpVerifyBtn")
      ?.addEventListener("click", () => this._handleVerify());

    // Botón reenvío
    document
      .getElementById("otpResendBtn")
      ?.addEventListener("click", () => this._handleResend());

    // Cerrar modal (bloqueado hasta completar la verificación)
    document.getElementById("otpCloseBtn")?.addEventListener("click", (e) => {
      if (this._isLocked) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      this.close();
    });
  },

  async _handleVerify() {
    const otp = Array.from(
      { length: 6 },
      (_, i) => document.getElementById(`otp-${i}`)?.value || "",
    ).join("");

    if (otp.length < 6) {
      this._showError("Ingresa los 6 dígitos del código.");
      return;
    }

    const btn = document.getElementById("otpVerifyBtn");
    btn.disabled = true;
    btn.querySelector("span").textContent = "Verificando...";

    try {
      const data = await verifyOtpService({ email: this._email, otp });
      SessionManager.saveSession(data);
      SessionManager.startSilentRefresh();
      notify.success("¡Cuenta verificada! Bienvenido a ProveelLink.");
      this._setLockedState(false);
      this.close();
      setTimeout(() => {
        Router.redirectByRole();
      }, 800);
    } catch (err) {
      this._showError(err.message || "Código incorrecto. Intenta de nuevo.");
      // Sacude los inputs visualmente
      document.getElementById("otpInputsWrap")?.classList.add("otp-shake");
      setTimeout(
        () =>
          document
            .getElementById("otpInputsWrap")
            ?.classList.remove("otp-shake"),
        600,
      );
    } finally {
      btn.disabled = false;
      btn.querySelector("span").textContent = "Verificar código";
    }
  },

  /** Solicita un nuevo OTP al servidor. */
  async _handleResend() {
    const btn = document.getElementById("otpResendBtn");
    btn.disabled = true;

    try {
      await resendOtpService({ email: this._email });
      notify.info("Nuevo código enviado. Revisa tu correo.");
      this._clearError();
      // Reinicia el timer OTP (cancela el anterior automáticamente)
      SessionManager.startOtpTimer(15 * 60, ({ minutes, seconds, expired }) => {
        this._updateTimer(minutes, seconds, expired);
      });
      // Limpia los inputs
      for (let i = 0; i < 6; i++) {
        const inp = document.getElementById(`otp-${i}`);
        if (inp) inp.value = "";
      }
      document.getElementById("otp-0")?.focus();
    } catch (err) {
      notify.error(err.message || "No se pudo reenviar el código.");
      btn.disabled = false;
    }
  },

  _setLockedState(isLocked) {
    this._isLocked = isLocked;
    const closeBtn = document.getElementById("otpCloseBtn");
    if (closeBtn) {
      closeBtn.disabled = isLocked;
      closeBtn.classList.toggle("is-disabled", isLocked);
      closeBtn.setAttribute("aria-disabled", String(isLocked));
    }
  },

  /** Actualiza el display del timer y gestiona el estado de expiración. */
  _updateTimer(minutes, seconds, expired) {
    const display = document.getElementById("otpTimerDisplay");
    const wrap = document.getElementById("otpTimerWrap");
    const resend = document.getElementById("otpResendBtn");
    const verify = document.getElementById("otpVerifyBtn");

    if (!display) return;

    display.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    if (expired) {
      wrap?.classList.add("otp-timer--expired");
      display.textContent = "Expirado";
      if (resend) resend.disabled = false;
      if (verify) verify.disabled = true;
      this._showError("El código ha expirado. Solicita uno nuevo.");
    } else if (minutes === 0 && seconds <= 30) {
      wrap?.classList.add("otp-timer--urgent");
    }
  },

  _showError(msg) {
    const el = document.getElementById("otpErrorMsg");
    if (el) {
      el.textContent = msg;
      el.style.display = "block";
    }
    // Marca inputs en estado error
    for (let i = 0; i < 6; i++) {
      document.getElementById(`otp-${i}`)?.classList.add("otp-input--error");
    }
  },

  _clearError() {
    const el = document.getElementById("otpErrorMsg");
    if (el) {
      el.textContent = "";
      el.style.display = "none";
    }
    for (let i = 0; i < 6; i++) {
      document.getElementById(`otp-${i}`)?.classList.remove("otp-input--error");
    }
  },
};

const AuthManager = {
  containerId: "#app-content",

  init() {
    this.renderLogin();
  },

  getContainer() {
    return document.querySelector(this.containerId);
  },

  renderLogin() {
    const container = this.getContainer();
    if (!container) return;
    container.innerHTML = AuthTemplates.login();
    this._bindLoginEvents();
  },

  renderRegister() {
    const container = this.getContainer();
    if (!container) return;
    container.innerHTML = AuthTemplates.register();
    this._bindRegisterEvents();
  },

  _bindLoginEvents() {
    const form = document.getElementById("loginForm");
    const toggleBtn = document.getElementById("togglePassword");
    const passInput = document.getElementById("password");
    const toRegister = document.getElementById("linkToRegister");
    toggleBtn?.addEventListener("click", () => {
      passInput.type = passInput.type === "password" ? "text" : "password";
    });

    toRegister?.addEventListener("click", (e) => {
      e.preventDefault();
      this.renderRegister();
    });

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value.trim();
      const password = passInput.value;
      let valid = true;
      if (!Validators.email(email)) {
        this._setFieldError("email", "Ingresa un correo electrónico válido.");
        valid = false;
      } else {
        this._clearFieldError("email");
      }
      if (!password) {
        this._setFieldError("password", "La contraseña es obligatoria.");
        valid = false;
      } else {
        this._clearFieldError("password");
      }
      if (!valid) return;

      this._setLoading("loginSubmit", true);
      try {
        const data = await loginService({ email, password });

        // ── Flujo especial: Admin detectado ────────────────────────────────
        // El backend no emite tokens todavía — envió OTP al correo del admin.
        // Redirigimos al panel de administración donde el admin puede ingresar
        // el código OTP que ya recibió en su correo.
        const requiresOtp = data.requiresOtp || data.data?.requiresOtp;
        if (requiresOtp) {
          const adminEmail = data.email || data.data?.email || email;
          notify.info(
            "Cuenta de administrador detectada. Redirigiendo al panel de administración…",
          );
          setTimeout(() => {
            // Siempre relativo a index.html (raíz del frontend)
            window.location.href =
              `./pages/admin/login.html?email=${encodeURIComponent(adminEmail)}&otp_sent=1`;
          }, 1800);
          return; // detiene el flujo normal de login
        }
        // ──────────────────────────────────────────────────────────────────

        SessionManager.saveSession(data);
        SessionManager.startSilentRefresh();
        notify.success("¡Inicio de sesión exitoso!");
        setTimeout(() => {
          Router.redirectByRole();
        }, 700);
      } catch (err) {
        notify.error(err.message || "Credenciales incorrectas.");
      } finally {
        this._setLoading("loginSubmit", false);
      }
    });
  },

  // ── REGISTER ───────────────────────────────────────────────────────────────

  _bindRegisterEvents() {
    const form = document.getElementById("registerForm");
    const toLogin = document.getElementById("linkToLogin");

    toLogin?.addEventListener("click", (e) => {
      e.preventDefault();
      this.renderLogin();
    });

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("regEmail").value.trim();
      const password = document.getElementById("regPassword").value;

      // Validación cliente
      let valid = true;
      if (!Validators.email(email)) {
        this._setFieldError(
          "regEmail",
          "Ingresa un correo electrónico válido.",
        );
        valid = false;
      } else {
        this._clearFieldError("regEmail");
      }
      if (!Validators.password(password)) {
        this._setFieldError(
          "regPassword",
          "Mínimo 8 caracteres, 1 mayúscula, 1 número y 1 símbolo.",
        );
        valid = false;
      } else {
        this._clearFieldError("regPassword");
      }
      if (!valid) return;

      this._setLoading("registerSubmit", true);
      try {
        await registerService({ email, password });
        notify.info("Cuenta creada. Te enviamos un código de verificación.");
        // Abre el modal OTP — el flujo continúa ahí
        OtpModal.open(email);
      } catch (err) {
        notify.error(err.message || "No se pudo completar el registro.");
      } finally {
        this._setLoading("registerSubmit", false);
      }
    });
  },

  _setFieldError(fieldId, message) {
    const card = document.getElementById(`card-${fieldId}`);
    const error = document.getElementById(`error-${fieldId}`);
    card?.classList.add("input-card--error");
    if (error) {
      error.textContent = message;
      error.style.display = "block";
    }
  },

  _clearFieldError(fieldId) {
    const card = document.getElementById(`card-${fieldId}`);
    const error = document.getElementById(`error-${fieldId}`);
    card?.classList.remove("input-card--error");
    if (error) {
      error.textContent = "";
      error.style.display = "none";
    }
  },

  _setLoading(btnId, isLoading) {
    const btn = document.getElementById(btnId);
    const span = btn?.querySelector("span");
    if (!btn) return;
    btn.disabled = isLoading;
    if (span)
      span.textContent = isLoading
        ? "Por favor espera…"
        : btn.dataset.label || span.textContent;
  },
};

document.addEventListener("DOMContentLoaded", () => {
  AuthManager.init();
});
