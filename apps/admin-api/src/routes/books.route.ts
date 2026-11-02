import { Router } from "express";
import {
  listBooks,
  getBook,
  getBookBySlug,
  createBook,
  updateBook,
  togglePublishBook,
  deleteBook,
  getBookRecommendations,
  syncBookRecommendations,
} from "../controllers/books.controller";
import * as bookAIController from "../controllers/book-ai.controller";
// Content-product-link gating disabled, routes commented out
// import {
//   listBookLinkedProducts,
//   setBookLinkedProducts,
// } from "../controllers/content-product-links.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requireAiAuthoring } from "../middlewares/ai-authoring.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const booksRouter: Router = Router();

booksRouter.use(asyncHandler(authenticateTenantUser));

// AI (must be before :bookId to avoid "ai" being parsed as bookId)
booksRouter.post("/ai/generate", asyncHandler(requirePermission("books.create")), asyncHandler(requireAiAuthoring), asyncHandler(bookAIController.submitGeneration));
booksRouter.get("/ai/status/:jobId", asyncHandler(requirePermission("books.create")), asyncHandler(bookAIController.getGenerationStatus));

// Book CRUD (by-slug must be before :bookId)
booksRouter.get("/by-slug/:slug", asyncHandler(requirePermission("books.view")), asyncHandler(getBookBySlug));
booksRouter.get("/", asyncHandler(requirePermission("books.view")), asyncHandler(listBooks));
booksRouter.post("/", asyncHandler(requirePermission("books.create")), asyncHandler(createBook));
// Recommendations (must be before :bookId to avoid "recommendations" matching as bookId)
booksRouter.get("/:bookId/recommendations", asyncHandler(requirePermission("books.update")), asyncHandler(getBookRecommendations));
booksRouter.put("/:bookId/recommendations/sync", asyncHandler(requirePermission("books.update")), asyncHandler(syncBookRecommendations));
booksRouter.get("/:bookId", asyncHandler(requirePermission("books.view")), asyncHandler(getBook));
booksRouter.put("/:bookId", asyncHandler(requirePermission("books.update")), asyncHandler(updateBook));
booksRouter.post("/:bookId/toggle-publish", asyncHandler(requirePermission("books.publish")), asyncHandler(togglePublishBook));
booksRouter.delete("/:bookId", asyncHandler(requirePermission("books.delete")), asyncHandler(deleteBook));

// Content-Product Links, disabled (content-product-link gating removed)
// booksRouter.get("/:bookId/linked-products", asyncHandler(requirePermission('books.update')), asyncHandler(listBookLinkedProducts));
// booksRouter.put("/:bookId/linked-products", asyncHandler(requirePermission('books.update')), asyncHandler(setBookLinkedProducts));

export default booksRouter;
