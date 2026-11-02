/**
 * Educational placeholder image URLs for course thumbnails (Unsplash).
 * Used when no custom thumbnail is set (course cards and editor preview).
 */
const EDUCATIONAL_PLACEHOLDER_IMAGES = [
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=400&h=225&fit=crop", // books / study
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=225&fit=crop", // laptop / online learning
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=225&fit=crop", // collaboration / learning
  "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=225&fit=crop", // education / classroom
  "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=225&fit=crop", // notebook / learning
];

/** Pick a stable educational placeholder image for a given seed (e.g. course slug or id). */
export function getEducationalPlaceholderImage(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % EDUCATIONAL_PLACEHOLDER_IMAGES.length;
  return EDUCATIONAL_PLACEHOLDER_IMAGES[index];
}
