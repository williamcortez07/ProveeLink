import * as companyService from "../companies/companyService.js";
import { asyncWrapper } from "../../utils/asyncWrapper.js";

export const createCompany = asyncWrapper(async (req, res) => {
  const result = await companyService.createCompanyService(req.body);
  const { company, tokens } = result;

  const responseBody = {
    success: true,
    message: "Empresa registrada exitosamente",
    data: company,
  };
  if (tokens) {
    responseBody.auth = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      message:
        "Tu rol ha sido actualizado a Empresa. Reemplaza tus tokens de sesión.",
    };
  }

  res.status(201).json(responseBody);
});

export const getCompanies = asyncWrapper(async (req, res) => {
  const result = await companyService.getCompanyService(req.query);
  res.status(200).json({
    success: true,
    message: "Empresas recuperadas exitosamente",
    data: result.data,
    pagination: result.pagination,
  });
});

export const searchCompanies = asyncWrapper(async (req, res) => {
  const result = await companyService.searchCompaniesService(req.query);
  res.status(200).json({
    success: true,
    message: "Búsqueda de empresas realizada con éxito",
    data: result.data,
    pagination: result.pagination,
  });
});

export const getCompanyById = asyncWrapper(async (req, res) => {
  const company = await companyService.getCompanyByIdService(req.params.id);
  res.status(200).json({
    success: true,
    message: "Empresa encontrada exitosamente",
    data: company,
  });
});

export const updateCompany = asyncWrapper(async (req, res) => {
  const updatedCompany = await companyService.updateCompanyService(
    req.params.id,
    req.body,
  );
  res.status(200).json({
    success: true,
    message: "Empresa actualizada exitosamente",
    data: updatedCompany,
  });
});
