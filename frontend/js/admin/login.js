/**
 * @file login.js
 * @description Lógica del flujo de autenticación administrativo.
 * Paso 1: email + contraseña → detecta requiresOtp
 * Paso 2: verificación OTP → emite tokens y redirige al dashboard
 */

import { authAdminApi } from "../../js/admin/adminApi.js";
import {
  AdminSession,
  admToast,
  redirectIfAlreadyLogged,
} from "../../js/admin/adminAuth.js";

// Si ya está autenticado como admin, redirigir al dashboard
redirectIfAlreadyLogged();

// ─────────────────────────────────────────────────────────────────────────────
// INICIO RÁPIDO DESDE LOGIN COMÚN
// Si el usuario llegó aquí redirigido desde index.html (common login) con
// ?email=xxx&otp_sent=1, significa que el backend ya envió el OTP.
// Pre-llenamos el email y saltamos directo al paso 2 (verificar OTP).
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const preEmail = params.get("email");
  const otpSent = params.get("otp_sent") === "1";

  if (preEmail && otpSent) {
    // Pre-llenar el campo email por si el admin quiere volver al paso 1
    const emailEl = document.getElementById("adminEmail");
    if (emailEl) emailEl.value = preEmail;
    // Saltar directo al paso OTP (el código ya fue enviado)
    showOtpStep(preEmail);
  }
});

let _adminEmail = null;
let _otpTimer = null;

const stepLogin = document.getElementById("stepLogin");
const stepOtp = document.getElementById("stepOtp");
const loginForm = document.getElementById("adminLoginForm");
const emailInput = document.getElementById("adminEmail");
const passInput = document.getElementById("adminPassword");
const togglePass = document.getElementById("toggleAdminPass");
const loginBtn = document.getElementById("loginSubmitBtn");
const loginBtnText = document.getElementById("loginBtnText");
const loginError = document.getElementById("loginError");

const otpEmailEl = document.getElementById("otpEmail");
const otpVerifyBtn = document.getElementById("otpVerifyBtn");
const otpBtnText = document.getElementById("otpBtnText");
const otpResendBtn = document.getElementById("otpResendBtn");
const otpError = document.getElementById("otpError");
const otpTimerDisp = document.getElementById("otpTimerDisplay");
const otpTimerWrap = document.getElementById("otpTimerWrap");
const backBtn = document.getElementById("backToLoginBtn");

function showLoginError(msg) {
  loginError.textContent = msg;
  loginError.classList.add("show");
}
function clearLoginError() {
  loginError.classList.remove("show");
  loginError.textContent = "";
}

function showOtpError(msg) {
  otpError.textContent = msg;
  otpError.classList.add("show");
  document
    .querySelectorAll(".adm-otp-input")
    .forEach((i) => i.classList.add("adm-otp-input--error"));
}
function clearOtpError() {
  otpError.classList.remove("show");
  document
    .querySelectorAll(".adm-otp-input")
    .forEach((i) => i.classList.remove("adm-otp-input--error"));
}

function setLoginLoading(loading) {
  loginBtn.disabled = loading;
  loginBtnText.textContent = loading ? "Verificando..." : "Continuar";
}

function setOtpLoading(loading) {
  otpVerifyBtn.disabled = loading;
  otpBtnText.textContent = loading ? "Verificando..." : "Verificar código";
}

function getOtpCode() {
  return Array.from(
    { length: 6 },
    (_, i) => document.getElementById(`otp-${i}`)?.value ?? "",
  ).join("");
}

function clearOtpInputs() {
  for (let i = 0; i < 6; i++) {
    const inp = document.getElementById(`otp-${i}`);
    if (inp) inp.value = "";
  }
  document.getElementById("otp-0")?.focus();
}

function startTimer(seconds = 600) {
  clearTimer();
  let remaining = seconds;

  function tick() {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    otpTimerDisp.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

    if (remaining <= 0) {
      otpTimerWrap.classList.add("adm-login-timer--expired");
      otpTimerDisp.textContent = "Expirado";
      otpVerifyBtn.disabled = true;
      otpResendBtn.disabled = false;
      showOtpError("El código ha expirado. Solicita uno nuevo.");
      clearTimer();
      return;
    }
    if (remaining <= 60) otpTimerWrap.style.color = "var(--adm-danger)";
    remaining--;
  }

  tick();
  _otpTimer = setInterval(tick, 1000);
}

function clearTimer() {
  if (_otpTimer) {
    clearInterval(_otpTimer);
    _otpTimer = null;
  }
}

function showOtpStep(email) {
  _adminEmail = email;
  otpEmailEl.textContent = email;
  stepLogin.style.display = "none";
  stepOtp.style.display = "block";
  otpVerifyBtn.disabled = false;
  otpResendBtn.disabled = true;
  clearOtpError();
  clearOtpInputs();
  startTimer(600);
  setTimeout(() => document.getElementById("otp-0")?.focus(), 100);
}

function showLoginStep() {
  clearTimer();
  stepOtp.style.display = "none";
  stepLogin.style.display = "block";
  clearLoginError();
}

for (let i = 0; i < 6; i++) {
  const inp = document.getElementById(`otp-${i}`);
  if (!inp) continue;

  inp.addEventListener("input", (e) => {
    const val = e.target.value.replace(/\D/g, "");
    e.target.value = val.slice(0, 1);
    clearOtpError();
    if (val && i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
  });

  inp.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !e.target.value && i > 0) {
      document.getElementById(`otp-${i - 1}`)?.focus();
    }
    if (e.key === "Enter") otpVerifyBtn.click();
  });

  inp.addEventListener("paste", (e) => {
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

togglePass?.addEventListener("click", () => {
  passInput.type = passInput.type === "password" ? "text" : "password";
});
loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearLoginError();

  const email = emailInput.value.trim();
  const password = passInput.value;

  if (!email) {
    document.getElementById("emailError").textContent =
      "El correo es obligatorio.";
    return;
  }
  if (!password) {
    document.getElementById("passwordError").textContent =
      "La contraseña es obligatoria.";
    return;
  }

  document.getElementById("emailError").textContent = "";
  document.getElementById("passwordError").textContent = "";

  setLoginLoading(true);
  try {
    const res = await authAdminApi.login({ email, password });

    // El backend retorna requiresOtp:true para cuentas Admin
    if (res.data?.requiresOtp || res.requiresOtp) {
      showOtpStep(res.data?.email ?? email);
    } else {
      // Caso en que no es admin — mostrar error
      showLoginError("Esta cuenta no tiene permisos de administrador.");
    }
  } catch (err) {
    showLoginError(err.message || "Credenciales incorrectas.");
  } finally {
    setLoginLoading(false);
  }
});

otpVerifyBtn?.addEventListener("click", async () => {
  clearOtpError();
  const code = getOtpCode();
  if (code.length < 6) {
    showOtpError("Ingresa los 6 dígitos del código.");
    return;
  }

  setOtpLoading(true);
  try {
    const res = await authAdminApi.verify({ email: _adminEmail, code });
    const tokenData = res.data ?? res;
    AdminSession.saveSession({
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
    });
    admToast.success("¡Bienvenido al Panel de Administración!");
    clearTimer();
    setTimeout(() => {
      window.location.href = "./dashboard.html";
    }, 800);
  } catch (err) {
    showOtpError(err.message || "Código incorrecto. Intenta de nuevo.");
  } finally {
    setOtpLoading(false);
  }
});

otpResendBtn?.addEventListener("click", async () => {
  otpResendBtn.disabled = true;
  clearOtpError();
  try {
    await authAdminApi.resend({ email: _adminEmail });
    admToast.info("Nuevo código enviado. Revisa tu correo.");
    clearOtpInputs();
    otpTimerWrap.classList.remove("adm-login-timer--expired");
    otpTimerWrap.style.color = "";
    otpVerifyBtn.disabled = false;
    startTimer(600);
  } catch (err) {
    admToast.error(err.message || "No se pudo reenviar el código.");
    otpResendBtn.disabled = false;
  }
});

backBtn?.addEventListener("click", showLoginStep);
