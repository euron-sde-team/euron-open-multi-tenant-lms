import {
  Award,
  BarChart3,
  BookOpen,
  Brush,
  Briefcase,
  Cake,
  CheckCircle,
  ChefHat,
  Clock,
  Coffee,
  DollarSign,
  Disc3,
  Dumbbell,
  Flame,
  Globe,
  GraduationCap,
  Headphones,
  Heart,
  Languages,
  Leaf,
  LineChart,
  MessageCircle,
  Mic,
  Music,
  Palette,
  PiggyBank,
  Pizza,
  Rocket,
  Scissors,
  Shield,
  Smile,
  Soup,
  Sparkles,
  Star,
  Target,
  ThumbsUp,
  Timer,
  TrendingUp,
  Trophy,
  Users,
  Utensils,
  UtensilsCrossed,
  Volume2,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Per-niche visual identity for the shared bespoke body sections. Add a niche
 * by dropping an entry into NICHE_VISUALS; unmapped niches use DEFAULT_VISUAL. */
export type NicheVariant =
  | "cooking"
  | "fitness"
  | "music"
  | "business"
  | "arts"
  | "kids"
  | "finance"
  | "language"
  | "skills";

export interface NicheVisual {
  featuresEyebrow: string;
  testimonialsEyebrow: string;
  ctaEyebrow: string;
  accentIcon: LucideIcon;
  /** Floating background motif icons. */
  motifIcons: LucideIcon[];
}

const DEFAULT_VISUAL: NicheVisual = {
  featuresEyebrow: "Why Choose Us",
  testimonialsEyebrow: "Loved by Learners",
  ctaEyebrow: "Get Started",
  accentIcon: Sparkles,
  motifIcons: [Sparkles, Star],
};

export const NICHE_VISUALS: Partial<Record<NicheVariant, NicheVisual>> = {
  cooking: {
    featuresEyebrow: "Why Cook With Us",
    testimonialsEyebrow: "From Our Kitchen Community",
    ctaEyebrow: "Start Cooking Today",
    accentIcon: ChefHat,
    motifIcons: [Pizza, Coffee, Cake, Soup],
  },
  fitness: {
    featuresEyebrow: "Why Train With Us",
    testimonialsEyebrow: "Real Results, Real People",
    ctaEyebrow: "Start Training Today",
    accentIcon: Dumbbell,
    motifIcons: [Dumbbell, Flame, Timer, Heart],
  },
  music: {
    featuresEyebrow: "Why Learn With Us",
    testimonialsEyebrow: "From Our Musicians",
    ctaEyebrow: "Start Making Music",
    accentIcon: Music,
    motifIcons: [Music, Disc3, Headphones, Mic],
  },
  business: {
    featuresEyebrow: "Why Teams Choose Us",
    testimonialsEyebrow: "Trusted by Leaders",
    ctaEyebrow: "Upskill Your Team",
    accentIcon: Briefcase,
    motifIcons: [TrendingUp, BarChart3, Target, Award],
  },
  arts: {
    featuresEyebrow: "Why Create With Us",
    testimonialsEyebrow: "From Our Makers",
    ctaEyebrow: "Start Creating Today",
    accentIcon: Palette,
    motifIcons: [Palette, Brush, Scissors, Sparkles],
  },
  kids: {
    featuresEyebrow: "Why Kids Love Us",
    testimonialsEyebrow: "Happy Parents & Kids",
    ctaEyebrow: "Start the Adventure",
    accentIcon: Sparkles,
    motifIcons: [Star, Sparkles, Smile, Heart],
  },
  finance: {
    featuresEyebrow: "Why Invest With Us",
    testimonialsEyebrow: "Trusted by Traders",
    ctaEyebrow: "Start Building Wealth",
    accentIcon: TrendingUp,
    motifIcons: [TrendingUp, LineChart, DollarSign, PiggyBank],
  },
  language: {
    featuresEyebrow: "Why Learn With Us",
    testimonialsEyebrow: "From Our Speakers",
    ctaEyebrow: "Start Speaking Today",
    accentIcon: Languages,
    motifIcons: [Languages, MessageCircle, Globe, Volume2],
  },
  skills: {
    featuresEyebrow: "Why Learn With Us",
    testimonialsEyebrow: "Career Success Stories",
    ctaEyebrow: "Level Up Your Skills",
    accentIcon: Rocket,
    motifIcons: [Rocket, Zap, Target, Award],
  },
};

export function getNicheVisual(v: NicheVariant): NicheVisual {
  return NICHE_VISUALS[v] ?? DEFAULT_VISUAL;
}

const ICONS: Record<string, LucideIcon> = {
  // shared
  award: Award,
  trophy: Trophy,
  book: BookOpen,
  graduation: GraduationCap,
  heart: Heart,
  star: Star,
  sparkles: Sparkles,
  users: Users,
  thumbsup: ThumbsUp,
  zap: Zap,
  shield: Shield,
  check: CheckCircle,
  clock: Clock,
  timer: Timer,
  target: Target,
  // cooking
  utensils: UtensilsCrossed,
  fork: Utensils,
  flame: Flame,
  leaf: Leaf,
  chef: ChefHat,
  coffee: Coffee,
  cake: Cake,
  // fitness
  dumbbell: Dumbbell,
  // music
  music: Music,
  mic: Mic,
  headphones: Headphones,
  disc: Disc3,
  // business / finance
  briefcase: Briefcase,
  chart: BarChart3,
  trending: TrendingUp,
  "line-chart": LineChart,
  dollar: DollarSign,
  piggy: PiggyBank,
  // arts
  palette: Palette,
  brush: Brush,
  scissors: Scissors,
  // kids
  smile: Smile,
  // language
  languages: Languages,
  message: MessageCircle,
  globe: Globe,
  volume: Volume2,
  // skills
  rocket: Rocket,
};

export function resolveNicheIcon(key: string): LucideIcon {
  return ICONS[key] ?? Sparkles;
}
