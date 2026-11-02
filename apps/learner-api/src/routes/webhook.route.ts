import { Router } from "express";
import { asyncHandler } from "../utils/asynchandler";
import * as webhookController from "../controllers/webhook.controller";

const router: Router = Router();

router.post("/razorpay", asyncHandler(webhookController.razorpayWebhook));
router.post("/stripe", asyncHandler(webhookController.stripeWebhook));

export default router;
