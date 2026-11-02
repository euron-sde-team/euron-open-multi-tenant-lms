import { z } from "zod";

// Image source schema
export const imageSourceSchema = z.enum(["upload", "url"]);

// Media image schema
export const mediaImageSchema = z.object({
  src: z.string(),
  alt: z.string(),
  source: imageSourceSchema,
  width: z.number().optional(),
  height: z.number().optional(),
});

// Video source schema
export const videoSourceSchema = z.enum(["youtube", "vimeo", "direct"]);

// Video info schema
export const videoInfoSchema = z.object({
  url: z.string(),
  source: videoSourceSchema,
  embedUrl: z.string().optional(),
  videoId: z.string().optional(),
  thumbnail: z.string().optional(),
  title: z.string().optional(),
  isValid: z.boolean(),
  error: z.string().optional(),
});

// Type exports from schemas
export type ImageSourceType = z.infer<typeof imageSourceSchema>;
export type MediaImageType = z.infer<typeof mediaImageSchema>;
export type VideoSourceType = z.infer<typeof videoSourceSchema>;
export type VideoInfoType = z.infer<typeof videoInfoSchema>;
