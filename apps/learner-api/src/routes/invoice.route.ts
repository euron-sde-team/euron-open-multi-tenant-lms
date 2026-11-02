import { Router } from "express";
import { asyncHandler } from "../utils/asynchandler";
import { listMyInvoices, getMyInvoice } from "../controllers/invoice.controller";

const invoiceRouter: Router = Router();

invoiceRouter.get("/", asyncHandler(listMyInvoices));
invoiceRouter.get("/:id", asyncHandler(getMyInvoice));

export default invoiceRouter;
