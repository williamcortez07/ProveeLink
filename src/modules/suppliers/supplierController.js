import * as supplierService from "../suppliers/supplierService.js";
import { asyncWrapper } from "../../utils/asyncWrapper.js";

export const createSupplier = asyncWrapper(async (req, res) => {
  const newSupplier = await supplierService.createSupplierService(req.body);
  res.status(201).json({
    success: true,
    message: "Proveedor registrado exitosamente",
    data: newSupplier,
  });
});

export const getSupplier = asyncWrapper(async (req, res) => {
  const result = await supplierService.getSuppliersService(req.query);
  res.status(200).json({
    success: true,
    message: "Proveedores recuperados exitosamente",
    data: result.data,
    pagination: result.pagination,
  });
});

export const searchSupplier = asyncWrapper(async (req, res) => {
  const result = await supplierService.searchSupplierService(req.query);
  res.status(200).json({
    success: true,
    message: "Búsqueda de proveedores realizada con éxito",
    data: result.data,
    pagination: result.pagination,
  });
});

export const getSupplierById = asyncWrapper(async (req, res) => {
  const supplier = await supplierService.getSupplierByIdService(req.params.id);
  res.status(200).json({
    success: true,
    message: "porveedor encontrado exitosamente",
    data: supplier,
  });
});

export const updateSupplier = asyncWrapper(async (req, res) => {
  const updatedSupplier = await supplierService.updateSupplierService(
    req.params.id,
    req.body,
  );
  res.status(200).json({
    success: true,
    message: "Proveedor actualizado exitosamente",
    data: updatedSupplier,
  });
});

export const changeSupplierStatus = asyncWrapper(async (req, res) => {
  const updatedSupplier = await supplierService.changeSupplierStatus(
    req.params.id,
    req.body.status,
  );
  res.status(200).json({
    success: true,
    message: "Estado del proveedor actualizado exitosamente",
    data: updatedSupplier,
  });
});
