export const getProfileImageUrl = (
  profilePic: string | null | undefined,
  fallbackImage = "/image/fallbackProfileImage.svg"
): string => {
  if (!profilePic) return fallbackImage;
  if (profilePic.startsWith("http://") || profilePic.startsWith("https://")) return profilePic;
  if (profilePic.startsWith("/")) return profilePic;
  // Relative S3 key (e.g. "users/<id>/avatar-<n>.jpeg"). Need NEXT_PUBLIC_PROFILE_BASE_URL
  // to build an absolute URL; without it, next/image throws because it cannot resolve a
  // bare key. Fall back to the placeholder rather than crashing the page.
  const base = process.env.NEXT_PUBLIC_PROFILE_BASE_URL;
  if (!base) return fallbackImage;
  return `${base.replace(/\/$/, "")}/${profilePic.replace(/^\//, "")}`;
};
