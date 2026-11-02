import { Router } from "express";
import {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/categories.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const categoriesRouter: Router = Router();

categoriesRouter.use(asyncHandler(authenticateTenantUser));

// Category CRUD
categoriesRouter.get("/", asyncHandler(requirePermission("categories.view")), asyncHandler(listCategories));
categoriesRouter.post("/", asyncHandler(requirePermission("categories.manage")), asyncHandler(createCategory));
categoriesRouter.get("/:categoryId", asyncHandler(requirePermission("categories.view")), asyncHandler(getCategory));
categoriesRouter.put("/:categoryId", asyncHandler(requirePermission("categories.manage")), asyncHandler(updateCategory));
categoriesRouter.delete("/:categoryId", asyncHandler(requirePermission("categories.manage")), asyncHandler(deleteCategory));

export default categoriesRouter;
