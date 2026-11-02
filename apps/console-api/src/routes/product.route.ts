import { Router } from "express";
import {
  listProducts,
  createProduct,
  getProductById,
  updateProduct,
} from "../controllers/product.controller";
import {
  authenticateAdmin,
  requirePermission,
} from "../middlewares/admin.auth.middleware";

const router: Router = Router();

// All routes require admin authentication
router.use(authenticateAdmin);

// List all products
// GET /admin/products
router.get("/", requirePermission("features.view"), listProducts);

// Create a new product
// POST /admin/products
router.post("/", requirePermission("features.manage"), createProduct);

// Get product by ID
// GET /admin/products/:id
router.get("/:id", requirePermission("features.view"), getProductById);

// Update a product
// PATCH /admin/products/:id
router.patch("/:id", requirePermission("features.manage"), updateProduct);

export default router;
