export interface Instructor {
  id: string;
  tenantId: string;
  name: string;
  email: string | null;
  bio: string | null;
  expertise: string | null;
  profileUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InstructorsListResponse {
  instructors: Instructor[];
  total: number;
  page: number;
  limit: number;
}

export interface InstructorExperience {
  id: string;
  instructorId: string;
  company: string;
  companyLogo: string | null;
  years: number;
  details: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface InstructorSocials {
  id: string;
  instructorId: string;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  youtubeUrl: string | null;
  githubUrl: string | null;
  websiteUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
}
