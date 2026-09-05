import * as adminService from "./adminService.js";
import { asyncWrapper } from "../../utils/asyncWrapper.js";

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

export const getDashboardStats = asyncWrapper(async (req, res) => {
  const stats = await adminService.getDashboardStatsService();
  res.status(200).json({ success: true, data: stats });
});

// ─────────────────────────────────────────────────────────────────────────────
// USUARIOS
// ─────────────────────────────────────────────────────────────────────────────

export const getAllUsers = asyncWrapper(async (req, res) => {
  const { page = 1, limit = 10, status, role_id, search, sortBy, sortOrder } = req.query;
  const result = await adminService.getAllUsersService({
    page: Number(page),
    limit: Number(limit),
    status,
    role_id,
    search,
    sortBy,
    sortOrder,
  });
  res.status(200).json({ success: true, ...result });
});

export const changeUserStatus = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const adminId = req.user.id;
  const updated = await adminService.changeUserStatusService(adminId, id, status);
  res.status(200).json({
    success: true,
    message: "Estado del usuario actualizado correctamente.",
    data: updated,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICACIONES
// ─────────────────────────────────────────────────────────────────────────────

export const getVerifications = asyncWrapper(async (req, res) => {
  const { page = 1, limit = 10, status = "pending", search } = req.query;
  const result = await adminService.getVerificationsService({
    page: Number(page),
    limit: Number(limit),
    status,
    search,
  });
  res.status(200).json({ success: true, ...result });
});

export const getCompanyDetail = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const company = await adminService.getCompanyDetailService(id);
  res.status(200).json({ success: true, data: company });
});

export const approveVerification = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const updated = await adminService.approveVerificationService(id);
  res.status(200).json({
    success: true,
    message: "Empresa aprobada como proveedor verificado.",
    data: updated,
  });
});

export const rejectVerification = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const updated = await adminService.rejectVerificationService(id);
  res.status(200).json({
    success: true,
    message: "Solicitud de verificación rechazada.",
    data: updated,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMINISTRADORES
// ─────────────────────────────────────────────────────────────────────────────

export const getAdministrators = asyncWrapper(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const result = await adminService.getAdministratorsService({
    page: Number(page),
    limit: Number(limit),
  });
  res.status(200).json({ success: true, ...result });
});

export const createAdministrator = asyncWrapper(async (req, res) => {
  const newAdmin = await adminService.createAdministratorService(req.body);
  res.status(201).json({
    success: true,
    message: "Cuenta de administrador creada exitosamente.",
    data: newAdmin,
  });
});
