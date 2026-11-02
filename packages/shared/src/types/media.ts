// Media types for image and video handling

export type ImageSource = "upload" | "url";

export interface MediaImage {
  src: string;
  alt: string;
  source: ImageSource;
  width?: number;
  height?: number;
}

export type VideoSource = "youtube" | "vimeo" | "direct";

export interface VideoInfo {
  url: string;
  source: VideoSource;
  embedUrl?: string;
  videoId?: string;
  thumbnail?: string;
  title?: string;
  isValid: boolean;
  error?: string;
}

// Video URL patterns
export const VIDEO_PATTERNS = {
  youtube: {
    // Matches youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
    regex: /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    getEmbedUrl: (videoId: string) => `https://www.youtube.com/embed/${videoId}`,
    getThumbnail: (videoId: string) => `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
  },
  vimeo: {
    // Matches vimeo.com/ID, player.vimeo.com/video/ID
    regex: /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/,
    getEmbedUrl: (videoId: string) => `https://player.vimeo.com/video/${videoId}`,
    getThumbnail: (videoId: string) => `https://vumbnail.com/${videoId}.jpg`,
  },
  direct: {
    // Matches common video file extensions
    regex: /\.(mp4|webm|ogg|mov|avi|mkv)(\?.*)?$/i,
    isValid: (url: string) => {
      try {
        new URL(url);
        return VIDEO_PATTERNS.direct.regex.test(url);
      } catch {
        return false;
      }
    },
  },
} as const;

// Helper function to parse video URL
export function parseVideoUrl(url: string): VideoInfo {
  if (!url || !url.trim()) {
    return {
      url: "",
      source: "direct",
      isValid: false,
      error: "Please enter a video URL",
    };
  }

  const trimmedUrl = url.trim();

  // Check YouTube
  const youtubeMatch = trimmedUrl.match(VIDEO_PATTERNS.youtube.regex);
  if (youtubeMatch) {
    const videoId = youtubeMatch[1];
    return {
      url: trimmedUrl,
      source: "youtube",
      videoId,
      embedUrl: VIDEO_PATTERNS.youtube.getEmbedUrl(videoId),
      thumbnail: VIDEO_PATTERNS.youtube.getThumbnail(videoId),
      isValid: true,
    };
  }

  // Check Vimeo
  const vimeoMatch = trimmedUrl.match(VIDEO_PATTERNS.vimeo.regex);
  if (vimeoMatch) {
    const videoId = vimeoMatch[1];
    return {
      url: trimmedUrl,
      source: "vimeo",
      videoId,
      embedUrl: VIDEO_PATTERNS.vimeo.getEmbedUrl(videoId),
      thumbnail: `https://vumbnail.com/${videoId}.jpg`,
      isValid: true,
    };
  }

  // Check direct video URL
  try {
    new URL(trimmedUrl);
    if (VIDEO_PATTERNS.direct.regex.test(trimmedUrl)) {
      return {
        url: trimmedUrl,
        source: "direct",
        embedUrl: trimmedUrl,
        isValid: true,
      };
    }
  } catch {
    return {
      url: trimmedUrl,
      source: "direct",
      isValid: false,
      error: "Invalid URL format",
    };
  }

  // URL is valid but not a recognized video format
  // Still allow it - might be a direct video link without extension
  try {
    new URL(trimmedUrl);
    return {
      url: trimmedUrl,
      source: "direct",
      embedUrl: trimmedUrl,
      isValid: true,
    };
  } catch {
    return {
      url: trimmedUrl,
      source: "direct",
      isValid: false,
      error: "Invalid URL format",
    };
  }
}
