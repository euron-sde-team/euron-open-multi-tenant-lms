// Re-export with explicit names to avoid conflicts
export {
  fetchPublishedCourses,
  type PublishedCourseListItem,
  type PublishedCoursesResponse,
  type CoursesListParams,
  type PaginationMeta,
} from "./courses";

export {
  fetchPublishedBooks,
  type PublishedBookListItem,
  type PublishedBooksResponse,
  type BooksListParams,
} from "./books";

export {
  checkoutApi,
  type CreateOrderBody,
  type CreateOrderResult,
  type VerifyPaymentBody,
  type VerifyPaymentResult,
  type RazorpayClientConfig,
  type OrderType,
} from "./checkout";

export {
  bookReadingApi,
  type BookHighlight,
  type BookPageBookmark,
  type ReadingProgress,
  type FullReadingData,
} from "./book-reading";

