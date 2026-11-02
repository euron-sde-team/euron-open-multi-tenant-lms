/**
 * Product sub-category definition for digital products.
 */
export interface ProductSubCategory {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
}

/**
 * Product category definition for digital products sold online (India + Worldwide).
 * Each category maps to a unique landing page template.
 */
export interface ProductCategory {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  color: string; // tailwind color class for badge/accent
  subCategories: ProductSubCategory[];
}
