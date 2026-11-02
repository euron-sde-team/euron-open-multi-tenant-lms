import { Router } from "express";
import { asyncHandler } from "../utils/asynchandler";
import { authenticateUser } from "../middlewares/auth.middleware";
import { addBookmark, removeBookmark, listBookmarks } from "../controllers/bookmark.controller";

const router: Router = Router();

router.use(asyncHandler(authenticateUser));

router.get("/", asyncHandler(listBookmarks));
router.post("/", asyncHandler(addBookmark));
router.delete("/", asyncHandler(removeBookmark));

export default router;
