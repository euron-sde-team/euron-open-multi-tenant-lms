import { Router } from "express";
import { asyncHandler } from "../utils/asynchandler";
import { listPaymentHistory } from "../controllers/payment-history.controller";

const paymentHistoryRouter: Router = Router();

paymentHistoryRouter.get("/", asyncHandler(listPaymentHistory));

export default paymentHistoryRouter;
