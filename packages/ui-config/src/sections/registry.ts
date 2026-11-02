import type {
  SectionType,
  HeroContent,
  HeroCodeTechContent,
  TestimonialsScrollCodeTechContent,
  CustomHtmlContent,
  FeaturesContent,
  TestimonialsContent,
  LogoCloudContent,
  StatsContent,
  AboutContent,
  FoundersContent,
  TeamContent,
  TimelineContent,
  GalleryContent,
  CTAContent,
  PricingContent,
  FAQContent,
  ContactFormContent,
  LoginFormContent,
  MemberProfileContent,
  AboutPageContent,
  ContactPageContent,
  PricingPageContent,
  FAQPageContent,
  PrivacyPageContent,
  TermsPageContent,
  CartPageContent,
  BookmarkPageContent,
  CourseCardsContent,
  BookShowcaseContent,
  ContentListingContent,
  AboutUsHeroContent,
  AboutUsMissionContent,
  AboutUsOfferingsContent,
  AboutUsValuesContent,
  AboutUsContactContent,
  ContactUsHeroContent,
  ContactUsInfoContent,
  ContactUsFormContent,
  FaqUsHeroContent,
  FaqUsListContent,
  PrivacyUsHeroContent,
  PrivacyUsContentContent,
  TermsUsHeroContent,
  TermsUsContentContent,
  HeroPhotographyContent,
  RecipesCookingContent,
  ProgramsFitnessContent,
  GenresMusicContent,
  OutcomesBusinessContent,
  ArtsGalleryContent,
  KidsPathContent,
  FinanceMarketsContent,
  LanguagePhrasesContent,
  SkillsTracksContent,
  NicheFeaturesContent,
  NicheTestimonialsContent,
  NicheCtaContent,
  AboutPhotographyContent,
  FeaturesPhotographyContent,
  TestimonialsPhotographyContent,
  CtaPhotographyContent,
  FaqPhotographyContent,
  GalleryPhotographyContent,
  HeroAstrologyContent,
  AboutAstrologyContent,
  ServicesAstrologyContent,
  TestimonialsAstrologyContent,
  CtaAstrologyContent,
  FaqAstrologyContent,
  SubscriptionHeroContent,
  SubscriptionFeaturesContent,
  SubscriptionComparisonContent,
  SubscriptionPricingContent,
  SubscriptionFaqContent,
  SubscriptionCtaContent,
  HeroMindfulnessContent,
  TeachMindfulnessContent,
  HowItWorksMindfulnessContent,
  TestimonialsMindfulnessContent,
  CtaMindfulnessContent,
  RoadmapMindfulnessContent,
  HeroExamprepContent,
  FeaturesExamprepContent,
  AboutExamprepContent,
  TestimonialsExamprepContent,
  FaqExamprepContent,
  CtaExamprepContent,
  ExamCategoriesGovtexamContent,
  TrustedByGovtexamContent,
  FeaturesSplitCorpupskillContent,
  AnalyticsCorpupskillContent,
  HeroSliderCorpupskillContent,
  SolutionsGridCorpupskillContent,
  TestimonialsCorpupskillContent,
  CtaCorpupskillContent,
} from "@open-mtlms/shared";

export interface SectionRegistryEntry {
  type: SectionType;
  name: string;
  description: string;
  category: string;
  icon: string;
  variants: {
    id: string;
    name: string;
    description: string;
  }[];
  defaultContent: unknown;
}

// Default content for each section type
const defaultHeroContent: HeroContent = {
  headline: "Transform Your Knowledge Into a Thriving Business",
  subheadline: "Create, sell, and scale your digital products with our all-in-one platform",
  description:
    "Join thousands of creators who have built successful online businesses with our powerful course creation and selling tools.",
  primaryCta: {
    text: "Start Free Trial",
    href: "/login",
    variant: "primary",
  },
  secondaryCta: {
    text: "Watch Demo",
    href: "/",
    variant: "outline",
  },
  image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80",
  imageAlt: "Platform dashboard preview",
};

const defaultHeroCodeTechContent: HeroCodeTechContent = {
  headline: "Code Your Way to Mastery",
  headlineAccent: "",
  headlinePrefix: "React, Node.js, Python & More",
  description:
    "Project-based courses by senior engineers from Google, Stripe, and Netflix. Build real apps, not toy demos. Ship to production on day one.",
  badge: "2,400 developers learning right now",
  primaryCta: {
    text: "Start Learning Free",
    href: "/login",
    variant: "primary",
  },
  secondaryCta: {
    text: "Watch Demo",
    href: "/",
    variant: "outline",
  },
  techLogos: [
    { id: "1", name: "React", icon: "react" },
    { id: "2", name: "TypeScript", icon: "typescript" },
    { id: "3", name: "Node.js", icon: "nodejs" },
    { id: "4", name: "Python", icon: "python" },
  ],
  socialProof: {
    avatars: [
      { id: "1", initial: "A", gradient: "from-primary to-primary/70" },
      { id: "2", initial: "K", gradient: "from-blue-500 to-blue-600" },
      { id: "3", initial: "M", gradient: "from-emerald-500 to-emerald-600" },
      { id: "4", initial: "S", gradient: "from-purple-500 to-purple-600" },
    ],
    totalCount: "50K",
    rating: "4.9/5",
    reviewCount: "12K reviews",
  },
  image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80",
  imageAlt: "Code editor dashboard preview",
  stats: [
    { id: "1", value: "200", suffix: "+", label: "Courses" },
    { id: "2", value: "50K", suffix: "+", label: "Learners" },
    { id: "3", value: "95", suffix: "%", label: "Completion" },
  ],
  techLogosLabel: "Learn",
  featuredInLabel: "Featured in",
  editorChrome: {
    activeTab: "dashboard.tsx",
    inactiveTab: "api.ts",
    statusLabel: "Live",
    host: "localhost:3000",
    statusLine: "No errors · 0 warnings",
  },
  featuredIn: [
    { id: "1", name: "TechCrunch" },
    { id: "2", name: "Product Hunt" },
    { id: "3", name: "Hacker News" },
  ],
  codeTickerItems: [
    "const app = express()",
    "import { useState } from 'react'",
    "async function deploy() { await build() }",
    "SELECT * FROM courses WHERE rating > 4.5",
    "docker compose up -d --build",
    "git push origin main",
    "npm run dev -- --port 3000",
    "export default function Home() { return <Layout /> }",
  ],
};

const defaultCustomHtmlContent: CustomHtmlContent = {
  customHtml: `<div style="font-family: system-ui, sans-serif; text-align:center; padding:56px 20px; background:linear-gradient(135deg,#eef2ff,#fdf2f8);">
  <h2 style="font-size:2rem; margin:0 0 10px; color:#4f46e5;">Your custom section</h2>
  <p style="color:#475569; margin:0 0 20px;">Edit the HTML for this block. It renders safely in a sandboxed frame and sizes to your content.</p>
  <a href="/all-courses" style="display:inline-block; background:#4f46e5; color:#fff; padding:12px 22px; border-radius:10px; font-weight:600; text-decoration:none;">Browse courses</a>
</div>`,
  minHeight: 200,
};

const defaultFeaturesContent: FeaturesContent = {
  headline: "Everything You Need to Succeed",
  subheadline: "Powerful features to help you create, market, and sell your digital products",
  features: [
    {
      id: "1",
      icon: "book-open",
      title: "Course Builder",
      description:
        "Create beautiful courses with our drag-and-drop builder. Add videos, quizzes, and assignments.",
    },
    {
      id: "2",
      icon: "credit-card",
      title: "Payment Processing",
      description:
        "Accept payments worldwide with integrated Stripe and PayPal. Support for subscriptions and one-time payments.",
    },
    {
      id: "3",
      icon: "users",
      title: "Student Management",
      description:
        "Track student progress, send automated emails, and manage enrollments all in one place.",
    },
    {
      id: "4",
      icon: "bar-chart",
      title: "Analytics Dashboard",
      description:
        "Get insights into your sales, student engagement, and course performance with detailed analytics.",
    },
    {
      id: "5",
      icon: "globe",
      title: "Custom Domain",
      description:
        "Use your own domain name for a professional look. SSL certificates included for free.",
    },
    {
      id: "6",
      icon: "shield",
      title: "Content Protection",
      description: "Protect your content with DRM, watermarking, and secure video hosting.",
    },
  ],
};

const defaultTestimonialsContent: TestimonialsContent = {
  headline: "Loved by Creators Worldwide",
  subheadline: "See what our customers have to say about their experience",
  testimonials: [
    {
      id: "1",
      quote:
        "This platform transformed my business. I went from struggling to sell courses to making six figures in my first year.",
      author: "Sarah Johnson",
      role: "Course Creator",
      company: "Digital Marketing Pro",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80",
      rating: 5,
    },
    {
      id: "2",
      quote:
        "The ease of use is incredible. I had my first course up and running in just a few hours.",
      author: "Michael Chen",
      role: "Fitness Coach",
      company: "FitLife Academy",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80",
      rating: 5,
    },
    {
      id: "3",
      quote:
        "Customer support is amazing. They helped me migrate from another platform seamlessly.",
      author: "Emily Rodriguez",
      role: "Business Consultant",
      company: "Growth Strategies",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80",
      rating: 5,
    },
  ],
  videoHeadline: "Hear it from our learners",
  videoTestimonials: [
    {
      id: "v1",
      youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      title: "How this course changed my career",
      author: "Alex Morgan, Product Designer",
    },
  ],
};

const defaultLogoCloudContent: LogoCloudContent = {
  headline: "Trusted by Industry Leaders",
  logos: [
    {
      id: "1",
      name: "Company 1",
      logo: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=200&q=80",
    },
    {
      id: "2",
      name: "Company 2",
      logo: "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=200&q=80",
    },
    {
      id: "3",
      name: "Company 3",
      logo: "https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=200&q=80",
    },
    {
      id: "4",
      name: "Company 4",
      logo: "https://images.unsplash.com/photo-1611605698335-8b1569810432?w=200&q=80",
    },
    {
      id: "5",
      name: "Company 5",
      logo: "https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=200&q=80",
    },
    {
      id: "6",
      name: "Company 6",
      logo: "https://images.unsplash.com/photo-1614680376408-81e91ffe3db7?w=200&q=80",
    },
  ],
};

const defaultStatsContent: StatsContent = {
  headline: "Numbers That Speak for Themselves",
  stats: [
    { id: "1", value: "50K", label: "Active Creators", suffix: "+" },
    { id: "2", value: "2M", label: "Students Enrolled", suffix: "+" },
    { id: "3", value: "100M", label: "Revenue Generated", prefix: "$", suffix: "+" },
    { id: "4", value: "99.9", label: "Uptime", suffix: "%" },
  ],
};

const defaultAboutContent: AboutContent = {
  headline: "Our Mission",
  subheadline: "Empowering creators to share their knowledge with the world",
  content:
    "We believe everyone has valuable knowledge to share. Our platform makes it easy for experts, educators, and entrepreneurs to create and sell digital products that make a real impact. Founded in 2020, we've helped thousands of creators build successful online businesses.",
  image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80",
  imagePosition: "right",
  stats: [
    { id: "1", value: "2020", label: "Founded" },
    { id: "2", value: "50", label: "Team Members", suffix: "+" },
    { id: "3", value: "30", label: "Countries", suffix: "+" },
  ],
};

/**
 * Two people by default, because "founder and co founder" is the common case
 * and an admin removing one is easier than working out how to add one.
 */
const defaultFoundersContent: FoundersContent = {
  label: "Our founders",
  headline: "Meet the founders",
  subheadline: "The people who started the academy and still teach on it.",
  members: [
    {
      id: "founder-1",
      name: "Founder name",
      role: "Founder",
      bio: "A line or two about why they started this, and what they teach.",
    },
    {
      id: "founder-2",
      name: "Co founder name",
      role: "Co founder",
      bio: "A line or two about what they look after day to day.",
    },
  ],
};

const defaultTeamContent: TeamContent = {
  headline: "Meet Our Team",
  subheadline: "The people behind the platform",
  members: [
    {
      id: "1",
      name: "Alex Thompson",
      role: "CEO & Founder",
      bio: "Former educator turned entrepreneur with a passion for democratizing education.",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80",
      socialLinks: [
        { platform: "twitter", url: "https://twitter.com" },
        { platform: "linkedin", url: "https://linkedin.com" },
      ],
    },
    {
      id: "2",
      name: "Jessica Lee",
      role: "CTO",
      bio: "Tech veteran with 15 years of experience building scalable platforms.",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80",
      socialLinks: [
        { platform: "twitter", url: "https://twitter.com" },
        { platform: "github", url: "https://github.com" },
      ],
    },
    {
      id: "3",
      name: "David Park",
      role: "Head of Design",
      bio: "Award-winning designer focused on creating delightful user experiences.",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80",
      socialLinks: [{ platform: "dribbble", url: "https://dribbble.com" }],
    },
  ],
};

const defaultTimelineContent: TimelineContent = {
  headline: "Our Journey",
  subheadline: "Key milestones in our growth",
  items: [
    {
      id: "1",
      date: "2020",
      title: "Company Founded",
      description: "Started with a vision to democratize online education.",
    },
    {
      id: "2",
      date: "2021",
      title: "10K Creators",
      description: "Reached our first major milestone of 10,000 active creators.",
    },
    {
      id: "3",
      date: "2022",
      title: "Series A Funding",
      description: "Raised $15M to accelerate product development and expansion.",
    },
    {
      id: "4",
      date: "2023",
      title: "Global Expansion",
      description: "Launched in 30+ countries with localized payment support.",
    },
  ],
};

const defaultGalleryContent: GalleryContent = {
  headline: "See It in Action",
  items: [
    {
      id: "1",
      image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&q=80",
      alt: "Dashboard view",
      caption: "Intuitive dashboard",
    },
    {
      id: "2",
      image: "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=600&q=80",
      alt: "Course builder",
      caption: "Drag-and-drop builder",
    },
    {
      id: "3",
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80",
      alt: "Analytics",
      caption: "Detailed analytics",
    },
    {
      id: "4",
      image: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=600&q=80",
      alt: "Mobile view",
      caption: "Mobile responsive",
    },
  ],
  columns: 2,
};

const defaultCTAContent: CTAContent = {
  headline: "Ready to Start Your Journey?",
  subheadline: "Join thousands of creators who have transformed their expertise into income",
  description: "Start your 14-day free trial today. No credit card required.",
  primaryCta: {
    text: "Start Free Trial",
    href: "/login",
    variant: "primary",
  },
  secondaryCta: {
    text: "Talk to Sales",
    href: "/",
    variant: "outline",
  },
};

const defaultPricingContent: PricingContent = {
  headline: "Simple, Transparent Pricing",
  subheadline: "Choose the plan that fits your needs",
  tiers: [
    {
      id: "1",
      name: "Starter",
      description: "Perfect for getting started",
      price: "$29",
      period: "/month",
      features: [
        "Up to 3 courses",
        "100 students",
        "Basic analytics",
        "Email support",
        "Custom domain",
      ],
      cta: { text: "Get Started", href: "/login", variant: "outline" },
    },
    {
      id: "2",
      name: "Professional",
      description: "For growing creators",
      price: "$79",
      period: "/month",
      features: [
        "Unlimited courses",
        "Unlimited students",
        "Advanced analytics",
        "Priority support",
        "Custom branding",
        "Affiliate program",
      ],
      cta: { text: "Get Started", href: "/login", variant: "primary" },
      highlighted: true,
      badge: "Most Popular",
    },
    {
      id: "3",
      name: "Enterprise",
      description: "For large organizations",
      price: "Custom",
      features: [
        "Everything in Pro",
        "Dedicated account manager",
        "Custom integrations",
        "SLA guarantee",
        "White-label solution",
        "API access",
      ],
      cta: { text: "Contact Sales", href: "/", variant: "outline" },
    },
  ],
  showToggle: true,
  monthlyLabel: "Monthly",
  yearlyLabel: "Yearly (Save 20%)",
};

const defaultFAQContent: FAQContent = {
  headline: "Frequently Asked Questions",
  subheadline: "Everything you need to know about our platform",
  items: [
    {
      id: "1",
      question: "How do I get started?",
      answer:
        "Simply sign up for a free trial, and you can start creating your first course immediately. No credit card required.",
    },
    {
      id: "2",
      question: "What payment methods do you support?",
      answer:
        "We support all major credit cards, PayPal, and bank transfers in select countries. We handle all payment processing securely.",
    },
    {
      id: "3",
      question: "Can I use my own domain?",
      answer:
        "Yes! All plans include the ability to use your own custom domain. We provide free SSL certificates for all custom domains.",
    },
    {
      id: "4",
      question: "What's your refund policy?",
      answer:
        "We offer a 30-day money-back guarantee on all paid plans. If you're not satisfied, contact us for a full refund.",
    },
    {
      id: "5",
      question: "Do you offer discounts for annual billing?",
      answer: "Yes, you can save 20% by choosing annual billing on any of our paid plans.",
    },
  ],
};

const defaultContactFormContent: ContactFormContent = {
  headline: "Get in Touch",
  subheadline: "Have questions? We'd love to hear from you.",
  fields: {
    name: true,
    email: true,
    phone: false,
    company: true,
    message: true,
  },
  submitText: "Send Message",
  successMessage: "Thanks for reaching out! We'll get back to you within 24 hours.",
};

const defaultLoginFormContent: LoginFormContent = {
  headline: "Login",
  subheadline: "Sign in to your account",
  emailLabel: "Email",
  emailPlaceholder: "Enter your email",
  passwordLabel: "Password",
  passwordPlaceholder: "Enter your password",
  submitText: "Sign In",
  forgotPasswordText: "Forgot password?",
  forgotPasswordHref: "/forgot-password",
  socialProviders: [
    { id: "google", name: "Google", icon: "google", href: "/auth/google" },
    { id: "facebook", name: "Facebook", icon: "facebook", href: "/auth/facebook" },
    { id: "twitter", name: "Twitter", icon: "twitter", href: "/auth/twitter" },
  ],
  socialHeadline: "Or sign in with",
  footerText: "Need help?",
  footerLinkText: "Contact",
  footerLinkHref: "/contact",
};

const defaultMemberProfileContent: MemberProfileContent = {
  headline: "Profile",
  subheadline: "Manage your account settings",
  profileTabLabel: "Profile",
  settingsTabLabel: "Settings",
  firstNameLabel: "First Name",
  lastNameLabel: "Last Name",
  phoneLabel: "Phone Number",
  emailLabel: "Email",
  genderLabel: "Gender",
  aboutLabel: "About",
  phoneHint: "Country code must start with + (e.g. +91)",
  emailHint: "Email cannot be changed",
  firstNamePlaceholder: "First name",
  lastNamePlaceholder: "Last name",
  phonePlaceholder: "+91 9876543210",
  aboutPlaceholder: "Tell us about yourself",
  genderPlaceholder: "Select gender",
  otpPlaceholder: "Enter OTP",
  sendVerificationCodeText: "Send verification code",
  verifyText: "Verify",
  cancelOtpText: "Cancel",
  updateProfileText: "Update Profile",
  deleteAccountTitle: "Delete Account",
  deleteAccountDescription:
    "Permanently delete your account and all associated data. This action cannot be undone.",
  deleteAccountButton: "Delete Account",
  yesDeleteText: "Yes, delete my account",
  cancelText: "Cancel",
};

const defaultAboutPageContent: AboutPageContent = {
  headline: "About Us",
  subheadline: "Learn more about who we are and what we do",
  story:
    "We started with a simple mission: to make quality education accessible to everyone. Today, we serve thousands of learners worldwide, helping them acquire new skills and advance their careers.",
  storyImage: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80",
  storyImageAlt: "Our team at work",
  mission:
    "To democratize education and empower learners everywhere with world-class content and tools.",
  vision: "A world where anyone can learn anything, anytime, anywhere.",
  values: [
    {
      id: "1",
      icon: "heart",
      title: "Passion",
      description: "We love what we do and it shows in everything we create.",
    },
    {
      id: "2",
      icon: "users",
      title: "Community",
      description: "We believe learning is better together.",
    },
    {
      id: "3",
      icon: "zap",
      title: "Innovation",
      description: "We constantly push boundaries to improve the learning experience.",
    },
    {
      id: "4",
      icon: "shield",
      title: "Trust",
      description: "We are transparent, honest, and committed to our learners.",
    },
  ],
  stats: [
    { id: "1", value: "10K", label: "Active Learners", suffix: "+" },
    { id: "2", value: "500", label: "Courses", suffix: "+" },
    { id: "3", value: "50", label: "Instructors", suffix: "+" },
    { id: "4", value: "98", label: "Satisfaction", suffix: "%" },
  ],
  teamHeadline: "Meet Our Team",
  teamMembers: [
    {
      id: "1",
      name: "Alex Johnson",
      role: "CEO & Founder",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80",
    },
    {
      id: "2",
      name: "Sarah Chen",
      role: "Head of Content",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80",
    },
    {
      id: "3",
      name: "Mike Davis",
      role: "CTO",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80",
    },
  ],
};

const defaultContactPageContent: ContactPageContent = {
  headline: "Contact Us",
  subheadline: "We'd love to hear from you. Get in touch with our team.",
  formFields: {
    name: true,
    email: true,
    phone: false,
    company: false,
    message: true,
  },
  submitText: "Send Message",
  successMessage: "Thank you! We'll get back to you within 24 hours.",
  contactInfo: {
    email: "support@example.com",
    phone: "+1 (555) 123-4567",
    address: "123 Business Ave, Suite 100, City, State 10001",
    hours: "Mon–Fri 9:00 AM – 6:00 PM",
  },
};

const defaultPricingPageContent: PricingPageContent = {
  headline: "Simple, Transparent Pricing",
  subheadline: "Choose the plan that fits your needs. No hidden fees.",
  tiers: [
    {
      id: "1",
      name: "Starter",
      description: "For individuals getting started",
      price: "Free",
      period: "",
      features: ["Up to 3 courses", "Community access", "Basic analytics", "Email support"],
      cta: { text: "Get Started", href: "/login", variant: "outline" },
    },
    {
      id: "2",
      name: "Pro",
      description: "For professionals and growing teams",
      price: "$29",
      period: "/month",
      features: [
        "Unlimited courses",
        "Priority support",
        "Advanced analytics",
        "Custom branding",
        "API access",
        "Team management",
      ],
      cta: { text: "Start Free Trial", href: "/login", variant: "primary" },
      highlighted: true,
      badge: "Most Popular",
    },
    {
      id: "3",
      name: "Enterprise",
      description: "For large organizations",
      price: "$99",
      period: "/month",
      features: [
        "Everything in Pro",
        "Dedicated support",
        "SLA guarantee",
        "Custom integrations",
        "White-label",
        "Onboarding",
      ],
      cta: { text: "Contact Sales", href: "/contact", variant: "outline" },
    },
  ],
  faqHeadline: "Frequently Asked Questions",
  faqItems: [
    {
      id: "1",
      question: "Can I switch plans later?",
      answer:
        "Yes, you can upgrade or downgrade at any time. Changes take effect on your next billing cycle.",
    },
    {
      id: "2",
      question: "Is there a free trial?",
      answer: "Yes! The Pro plan comes with a 14-day free trial. No credit card required.",
    },
    {
      id: "3",
      question: "What payment methods do you accept?",
      answer: "We accept all major credit cards, PayPal, and bank transfers for annual plans.",
    },
  ],
  ctaHeadline: "Ready to get started?",
  ctaSubheadline: "Join thousands of learners and creators on our platform.",
  ctaButton: { text: "Start Free Trial", href: "/login", variant: "primary" },
};

const defaultFAQPageContent: FAQPageContent = {
  headline: "Frequently Asked Questions",
  subheadline: "Find answers to the most common questions about our platform",
  categories: [
    { id: "general", name: "General" },
    { id: "billing", name: "Billing" },
    { id: "support", name: "Support" },
  ],
  items: [
    {
      id: "1",
      question: "How do I get started?",
      answer:
        "Sign up for a free account and you can start exploring courses immediately. No credit card required.",
      category: "general",
    },
    {
      id: "2",
      question: "What courses are available?",
      answer:
        "We offer hundreds of courses across technology, business, design, and more. Browse our catalog to find the right fit.",
      category: "general",
    },
    {
      id: "3",
      question: "How does billing work?",
      answer:
        "We offer monthly and annual billing. You can upgrade, downgrade, or cancel anytime from your dashboard.",
      category: "billing",
    },
    {
      id: "4",
      question: "Can I get a refund?",
      answer: "Yes, we offer a 30-day money-back guarantee on all paid plans. No questions asked.",
      category: "billing",
    },
    {
      id: "5",
      question: "How do I contact support?",
      answer:
        "You can reach our support team via email at support@example.com or through the live chat on our website.",
      category: "support",
    },
    {
      id: "6",
      question: "What are the support hours?",
      answer:
        "Our support team is available Monday through Friday, 9 AM to 6 PM in your local timezone.",
      category: "support",
    },
  ],
  contactHeadline: "Still have questions?",
  contactText: "Can't find what you're looking for? Our team is here to help.",
  contactLinkText: "Contact Support",
  contactLinkHref: "/contact",
};

const defaultPrivacyPageContent: PrivacyPageContent = {
  headline: "Privacy Policy",
  subheadline: "How we collect, use, and protect your information",
  lastUpdated: "February 2026",
  sections: [
    {
      id: "1",
      title: "Information We Collect",
      content:
        "We collect information you provide directly to us, such as when you create an account, make a purchase, or contact us for support. This includes your name, email address, payment information, and any other information you choose to provide.",
    },
    {
      id: "2",
      title: "How We Use Your Information",
      content:
        "We use the information we collect to provide, maintain, and improve our services, process transactions, send you technical notices and support messages, and respond to your comments and questions.",
    },
    {
      id: "3",
      title: "Information Sharing",
      content:
        "We do not sell, trade, or otherwise transfer your personal information to third parties. We may share information with trusted service providers who assist us in operating our platform, conducting our business, or serving our users.",
    },
    {
      id: "4",
      title: "Data Security",
      content:
        "We implement appropriate technical and organizational measures to protect the security of your personal information. However, no method of transmission over the Internet is 100% secure.",
    },
    {
      id: "5",
      title: "Cookies",
      content:
        "We use cookies and similar tracking technologies to track activity on our platform and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.",
    },
    {
      id: "6",
      title: "Your Rights",
      content:
        "You have the right to access, update, or delete your personal information at any time. You can do this through your account settings or by contacting us directly.",
    },
    {
      id: "7",
      title: "Changes to This Policy",
      content:
        "We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the 'last updated' date.",
    },
  ],
  contactHeadline: "Questions about our privacy practices?",
  contactText: "If you have any questions about this Privacy Policy, please contact us.",
  contactEmail: "privacy@example.com",
};

const defaultBookmarkPageContent: BookmarkPageContent = {
  headline: "Your Bookmarks",
  subheadline: "Courses and content you've saved for later",
  emptyBookmarkMessage: "No bookmarks yet. Save courses to find them here!",
};

const defaultCartPageContent: CartPageContent = {
  headline: "Your Cart",
  subheadline: "Review your items and proceed to checkout",
  checkoutButtonText: "Proceed to Checkout",
  emptyCartMessage: "Your cart is empty. Add courses to get started!",
};

const defaultTermsPageContent: TermsPageContent = {
  headline: "Terms of Service",
  subheadline: "Please read these terms carefully before using our platform",
  lastUpdated: "February 2026",
  sections: [
    {
      id: "1",
      title: "Acceptance of Terms",
      content:
        "By accessing or using our platform, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site.",
    },
    {
      id: "2",
      title: "Use License",
      content:
        "Permission is granted to temporarily access the materials on our platform for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title.",
    },
    {
      id: "3",
      title: "User Accounts",
      content:
        "You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.",
    },
    {
      id: "4",
      title: "Payment Terms",
      content:
        "Paid services are billed in advance on a monthly or annual basis. You agree to pay all fees associated with your selected plan. Refunds are available within 30 days of purchase.",
    },
    {
      id: "5",
      title: "Intellectual Property",
      content:
        "All content, features, and functionality on our platform are owned by us and are protected by international copyright, trademark, and other intellectual property laws.",
    },
    {
      id: "6",
      title: "Limitation of Liability",
      content:
        "In no event shall we be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.",
    },
    {
      id: "7",
      title: "Governing Law",
      content:
        "These terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law provisions.",
    },
  ],
  contactHeadline: "Questions about our terms?",
  contactText: "If you have any questions about these Terms of Service, please contact us.",
  contactEmail: "legal@example.com",
};

const defaultCourseCardsContent: CourseCardsContent = {
  headline: "Popular Courses",
  subheadline: "Start learning today with our top-rated courses",
  courses: [
    {
      id: "1",
      title: "Python for Data Science",
      description: "Master Python programming and data analysis",
      instructor: "Dr. Sarah Chen",
      instructorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80",
      price: "$89",
      originalPrice: "$179",
      image: "https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=600&q=80",
      duration: "40 hours",
      lessons: 120,
      level: "beginner",
      rating: 4.9,
      students: 15000,
      href: "/self-paced",
    },
    {
      id: "2",
      title: "Advanced React Patterns",
      description: "Learn advanced React concepts and patterns",
      instructor: "John Smith",
      instructorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80",
      price: "$129",
      image: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=600&q=80",
      duration: "25 hours",
      lessons: 85,
      level: "advanced",
      rating: 4.8,
      students: 8500,
      href: "/self-paced",
    },
  ],
};

const defaultBookShowcaseContent: BookShowcaseContent = {
  headline: "Featured Books",
  subheadline: "Expand your knowledge with our curated collection",
  books: [
    {
      id: "1",
      title: "The Creator's Handbook",
      author: "Alex Thompson",
      description: "A comprehensive guide to building a successful creator business",
      price: "$24.99",
      originalPrice: "$39.99",
      cover: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&q=80",
      pages: 320,
      format: ["PDF", "EPUB", "Kindle"],
      rating: 4.9,
      href: "/",
    },
    {
      id: "2",
      title: "Marketing for Creators",
      author: "Emily Rodriguez",
      description: "Learn how to market your digital products effectively",
      price: "$19.99",
      cover: "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=400&q=80",
      pages: 250,
      format: ["PDF", "EPUB"],
      rating: 4.7,
      href: "/",
    },
  ],
};

// ── Content Listing default contents ──

const defaultAllCoursesListingContent: ContentListingContent = {
  headline: "Explore Our Courses",
  subheadline: "Start your learning journey today",
  itemCount: 8,
  seeAllLink: "/all-courses",
};

const defaultSelfPacedCoursesListingContent: ContentListingContent = {
  headline: "Self-Paced Courses",
  subheadline: "Learn at your own pace, on your own schedule",
  itemCount: 8,
  seeAllLink: "/self-paced",
};

const defaultBooksListingContent: ContentListingContent = {
  headline: "Browse Books",
  subheadline: "Expand your knowledge with our curated collection",
  itemCount: 8,
  seeAllLink: "/books",
};

const defaultBundlesListingContent: ContentListingContent = {
  headline: "Course Bundles",
  subheadline: "Save more with curated course bundles",
  itemCount: 8,
  seeAllLink: "/bundles",
};

const defaultCategoriesListingContent: ContentListingContent = {
  headline: "Browse Categories",
  subheadline: "Find courses and books by topic",
  itemCount: 8,
  seeAllLink: "/categories",
};

const defaultTestSeriesListingContent: ContentListingContent = {
  headline: "Test Series",
  subheadline: "Practice with full-length tests and detailed analytics",
  itemCount: 8,
  seeAllLink: "/test-series",
};

// Section Registry (header/footer removed - use layout header/footer only)
export const sectionRegistry: Record<
  Exclude<SectionType, "header" | "footer">,
  SectionRegistryEntry
> = {
  // Hero
  hero: {
    type: "hero",
    name: "Hero",
    description: "Main hero section",
    category: "hero",
    icon: "layout-distribute-vertical",
    variants: [{ id: "centered", name: "Centered", description: "Centered text with CTA" }],
    defaultContent: defaultHeroContent,
  },
  "hero-code-tech": {
    type: "hero-code-tech",
    name: "Hero: Code & Tech",
    description:
      "Dark, immersive hero for coding and technology platforms with floating cards, tech logos, code ticker, and stats bar",
    category: "hero",
    icon: "code-2",
    variants: [
      { id: "default", name: "Default", description: "Two-column layout with code editor visual" },
    ],
    defaultContent: defaultHeroCodeTechContent,
  },

  // Testimonials Scroll: Code & Tech
  "testimonials-scroll-code-tech": {
    type: "testimonials-scroll-code-tech",
    name: "Testimonials Scroll: Code & Tech",
    description: "Auto-scrolling testimonial screenshots in two rows with live data from API",
    category: "social-proof",
    icon: "message-circle",
    variants: [
      {
        id: "default",
        name: "Default",
        description: "Two-row infinite scroll with screenshot cards",
      },
    ],
    defaultContent: {
      headline: "Testimonials",
      headlineAccent: "",
      description:
        "Real conversations, real screenshots, real career transformations from our community.",
      cardLabel: "Success Story",
      emptyButtonText: "Add Testimonials",
    } satisfies TestimonialsScrollCodeTechContent,
  },

  // Features
  "custom-html": {
    type: "custom-html",
    name: "Custom HTML",
    description: "Your own HTML/CSS/JS in a sandboxed block",
    category: "content",
    icon: "code",
    variants: [
      { id: "default", name: "Default", description: "Sandboxed custom code block" },
    ],
    defaultContent: defaultCustomHtmlContent,
  },
  "features-grid": {
    type: "features-grid",
    name: "Features Grid",
    description: "Features in a grid layout",
    category: "features",
    icon: "grid-dots",
    variants: [
      { id: "3-col", name: "3 Columns", description: "Three column grid" },
      { id: "4-col", name: "4 Columns", description: "Four column grid" },
      { id: "icon-top", name: "Icon Top", description: "Icons above text" },
      { id: "icon-left", name: "Icon Left", description: "Icons beside text" },
    ],
    defaultContent: defaultFeaturesContent,
  },
  "features-list": {
    type: "features-list",
    name: "Features List",
    description: "Features in a list layout",
    category: "features",
    icon: "list",
    variants: [
      { id: "alternating", name: "Alternating", description: "Alternating left/right" },
      { id: "stacked", name: "Stacked", description: "Vertically stacked" },
    ],
    defaultContent: defaultFeaturesContent,
  },
  "features-tabs": {
    type: "features-tabs",
    name: "Features Tabs",
    description: "Features with tab navigation",
    category: "features",
    icon: "layout-list",
    variants: [
      { id: "horizontal", name: "Horizontal Tabs", description: "Tabs on top" },
      { id: "vertical", name: "Vertical Tabs", description: "Tabs on side" },
    ],
    defaultContent: defaultFeaturesContent,
  },
  "features-accordion": {
    type: "features-accordion",
    name: "Features Accordion",
    description: "Expandable feature sections",
    category: "features",
    icon: "layout-rows",
    variants: [
      { id: "simple", name: "Simple", description: "Basic accordion" },
      { id: "with-icons", name: "With Icons", description: "Accordion with icons" },
    ],
    defaultContent: defaultFeaturesContent,
  },

  // Social Proof
  "testimonials-carousel": {
    type: "testimonials-carousel",
    name: "Testimonials Carousel",
    description: "Sliding testimonials",
    category: "social-proof",
    icon: "carousel-horizontal",
    variants: [
      { id: "single", name: "Single", description: "One testimonial at a time" },
      { id: "multiple", name: "Multiple", description: "Multiple visible" },
      { id: "cards", name: "Cards", description: "Card-style carousel" },
    ],
    defaultContent: defaultTestimonialsContent,
  },
  "testimonials-grid": {
    type: "testimonials-grid",
    name: "Testimonials Grid",
    description: "Testimonials in a grid",
    category: "social-proof",
    icon: "grid-3x3",
    variants: [
      { id: "masonry", name: "Masonry", description: "Masonry layout" },
      { id: "uniform", name: "Uniform", description: "Equal height cards" },
      {
        id: "with-stats",
        name: "With Stats",
        description: "Testimonial grid with summary statistics bar",
      },
    ],
    defaultContent: defaultTestimonialsContent,
  },
  "logo-cloud": {
    type: "logo-cloud",
    name: "Logo Cloud",
    description: "Partner/client logos",
    category: "social-proof",
    icon: "building",
    variants: [
      { id: "simple", name: "Simple", description: "Static logo row" },
      { id: "scrolling", name: "Scrolling", description: "Auto-scrolling logos" },
      { id: "grid", name: "Grid", description: "Logo grid layout" },
    ],
    defaultContent: defaultLogoCloudContent,
  },
  "stats-counter": {
    type: "stats-counter",
    name: "Stats Counter",
    description: "Animated statistics",
    category: "social-proof",
    icon: "chart-bar",
    variants: [
      { id: "inline", name: "Inline", description: "Horizontal stats" },
      { id: "cards", name: "Cards", description: "Stats in cards" },
      { id: "large", name: "Large", description: "Big number display" },
      {
        id: "brand-strip",
        name: "Brand Strip",
        description: "Minimal logo/brand name display strip",
      },
    ],
    defaultContent: defaultStatsContent,
  },

  // Content
  about: {
    type: "about",
    name: "About",
    description: "About section",
    category: "content",
    icon: "info-circle",
    variants: [
      { id: "simple", name: "Simple", description: "Text only" },
      { id: "with-image", name: "With Image", description: "Text with image" },
      { id: "with-stats", name: "With Stats", description: "Include statistics" },
    ],
    defaultContent: defaultAboutContent,
  },
  founders: {
    type: "founders",
    name: "Founders",
    description: "The founder and co founders, with photo, role and a short bio",
    category: "content",
    icon: "users",
    variants: [{ id: "default", name: "Default", description: "Large cards with bios" }],
    defaultContent: defaultFoundersContent,
  },
  team: {
    type: "team",
    name: "Team",
    description: "Team member showcase",
    category: "content",
    icon: "users",
    variants: [
      { id: "grid", name: "Grid", description: "Team member grid" },
      { id: "carousel", name: "Carousel", description: "Sliding team cards" },
      { id: "detailed", name: "Detailed", description: "With bios" },
    ],
    defaultContent: defaultTeamContent,
  },
  timeline: {
    type: "timeline",
    name: "Timeline",
    description: "Chronological timeline",
    category: "content",
    icon: "timeline",
    variants: [
      { id: "vertical", name: "Vertical", description: "Vertical timeline" },
      { id: "horizontal", name: "Horizontal", description: "Horizontal timeline" },
      { id: "alternating", name: "Alternating", description: "Zigzag layout" },
    ],
    defaultContent: defaultTimelineContent,
  },
  gallery: {
    type: "gallery",
    name: "Gallery",
    description: "Image gallery",
    category: "content",
    icon: "photo",
    variants: [
      { id: "grid", name: "Grid", description: "Image grid" },
      { id: "masonry", name: "Masonry", description: "Masonry layout" },
      { id: "lightbox", name: "Lightbox", description: "With lightbox" },
    ],
    defaultContent: defaultGalleryContent,
  },

  // Conversion
  "cta-banner": {
    type: "cta-banner",
    name: "CTA Banner",
    description: "Call-to-action banner",
    category: "conversion",
    icon: "speakerphone",
    variants: [
      { id: "simple", name: "Simple", description: "Basic CTA" },
      { id: "gradient", name: "Gradient", description: "With gradient" },
      { id: "with-image", name: "With Image", description: "Include image" },
      {
        id: "newsletter",
        name: "Newsletter",
        description: "Email subscription with benefit pills",
      },
      {
        id: "hero-cta",
        name: "Hero CTA",
        description: "Dark background CTA with image overlay and trust badges",
      },
    ],
    defaultContent: defaultCTAContent,
  },
  "cta-split": {
    type: "cta-split",
    name: "CTA Split",
    description: "Split layout CTA",
    category: "conversion",
    icon: "layout-columns",
    variants: [
      { id: "image-left", name: "Image Left", description: "Image on left" },
      { id: "image-right", name: "Image Right", description: "Image on right" },
    ],
    defaultContent: {
      ...defaultCTAContent,
      image: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1200&q=80",
    },
  },
  "pricing-table": {
    type: "pricing-table",
    name: "Pricing Table",
    description: "Pricing plans comparison",
    category: "conversion",
    icon: "currency-dollar",
    variants: [
      { id: "cards", name: "Cards", description: "Pricing cards" },
      { id: "table", name: "Table", description: "Comparison table" },
      { id: "toggle", name: "Toggle", description: "Monthly/yearly toggle" },
      {
        id: "service-cards",
        name: "Service Cards",
        description: "Icon-based service cards with individual pricing",
      },
    ],
    defaultContent: defaultPricingContent,
  },
  "faq-accordion": {
    type: "faq-accordion",
    name: "FAQ Accordion",
    description: "Frequently asked questions",
    category: "conversion",
    icon: "help",
    variants: [
      { id: "simple", name: "Simple", description: "Basic FAQ" },
      { id: "categorized", name: "Categorized", description: "With categories" },
      { id: "search", name: "Searchable", description: "With search" },
    ],
    defaultContent: defaultFAQContent,
  },
  faq: {
    type: "faq",
    name: "FAQ",
    description: "Course FAQ section",
    category: "conversion",
    icon: "help",
    variants: [{ id: "default", name: "Default", description: "Standard FAQ layout" }],
    defaultContent: defaultFAQContent,
  },
  "contact-form": {
    type: "contact-form",
    name: "Contact Form",
    description: "Contact form section",
    category: "conversion",
    icon: "mail",
    variants: [
      { id: "simple", name: "Simple", description: "Basic form" },
      { id: "with-info", name: "With Info", description: "Form with contact info" },
      { id: "split", name: "Split", description: "Split layout" },
    ],
    defaultContent: defaultContactFormContent,
  },

  // Auth
  "login-form": {
    type: "login-form",
    name: "Login Form",
    description: "User login form with email, password, social login and forgot password",
    category: "auth",
    icon: "log-in",
    variants: [
      { id: "centered", name: "Centered Card", description: "Card centered on page" },
      { id: "split", name: "Split Layout", description: "Image left, form right" },
      { id: "minimal", name: "Minimal", description: "Clean form without card" },
    ],
    defaultContent: defaultLoginFormContent,
  },
  "member-profile": {
    type: "member-profile",
    name: "Member Profile",
    description:
      "User profile page with sidebar (Profile, Settings, Invoice, Subscription). No community features.",
    category: "auth",
    icon: "user",
    variants: [
      { id: "default", name: "Default", description: "Profile form with sidebar navigation" },
    ],
    defaultContent: defaultMemberProfileContent,
  },

  // Full-page sections
  "about-page": {
    type: "about-page",
    name: "About Page",
    description: "Complete about page with story, values, stats and team",
    category: "page",
    icon: "info",
    variants: [
      {
        id: "story-driven",
        name: "Story Driven",
        description: "Narrative layout with story, values, stats and team",
      },
      { id: "split", name: "Split Layout", description: "Image left, story right, values below" },
      { id: "minimal", name: "Minimal", description: "Clean text-focused layout" },
    ],
    defaultContent: defaultAboutPageContent,
  },
  "contact-page": {
    type: "contact-page",
    name: "Contact Page",
    description: "Complete contact page with form and contact info",
    category: "page",
    icon: "mail",
    variants: [
      { id: "with-info", name: "With Info", description: "Two-column: info left, form right" },
      { id: "centered", name: "Centered", description: "Centered card with form and info below" },
      { id: "minimal", name: "Minimal", description: "Just the form" },
    ],
    defaultContent: defaultContactPageContent,
  },
  "pricing-page": {
    type: "pricing-page",
    name: "Pricing Page",
    description: "Complete pricing page with tiers, FAQ and CTA",
    category: "page",
    icon: "credit-card",
    variants: [
      { id: "cards", name: "Cards", description: "Pricing cards with FAQ and CTA" },
      { id: "comparison", name: "Comparison", description: "Table-style feature comparison" },
      { id: "minimal", name: "Minimal", description: "Clean cards only" },
    ],
    defaultContent: defaultPricingPageContent,
  },
  "faq-page": {
    type: "faq-page",
    name: "FAQ Page",
    description: "Complete FAQ page with accordion, categories and contact block",
    category: "page",
    icon: "help-circle",
    variants: [
      { id: "accordion", name: "Accordion", description: "Simple Q&A accordion" },
      { id: "categorized", name: "Categorized", description: "FAQ grouped by category" },
      { id: "minimal", name: "Minimal", description: "Clean accordion, no contact block" },
    ],
    defaultContent: defaultFAQPageContent,
  },
  "privacy-page": {
    type: "privacy-page",
    name: "Privacy Policy Page",
    description: "Complete privacy policy page with sections and table of contents",
    category: "page",
    icon: "shield",
    variants: [
      { id: "standard", name: "Standard", description: "Full policy with TOC sidebar" },
      { id: "simple", name: "Simple", description: "Linear sections layout" },
      { id: "minimal", name: "Minimal", description: "Clean text only" },
    ],
    defaultContent: defaultPrivacyPageContent,
  },
  "bookmark-page": {
    type: "bookmark-page",
    name: "Bookmark Page",
    description: "Saved courses and content",
    category: "page",
    icon: "bookmark",
    variants: [{ id: "default", name: "Default", description: "Standard bookmark layout" }],
    defaultContent: defaultBookmarkPageContent,
  },
  "cart-page": {
    type: "cart-page",
    name: "Cart Page",
    description: "Shopping cart with editable headline and checkout button",
    category: "page",
    icon: "shopping-cart",
    variants: [{ id: "default", name: "Default", description: "Standard cart layout" }],
    defaultContent: defaultCartPageContent,
  },
  "terms-page": {
    type: "terms-page",
    name: "Terms of Service Page",
    description: "Complete terms of service page with sections and table of contents",
    category: "page",
    icon: "file-text",
    variants: [
      { id: "standard", name: "Standard", description: "Full terms with TOC sidebar" },
      { id: "simple", name: "Simple", description: "Linear sections layout" },
      { id: "minimal", name: "Minimal", description: "Clean text only" },
    ],
    defaultContent: defaultTermsPageContent,
  },

  "course-cards": {
    type: "course-cards",
    name: "Course Cards",
    description: "Course showcase",
    category: "ecommerce",
    icon: "school",
    variants: [
      { id: "grid", name: "Grid", description: "Course card grid" },
      { id: "list", name: "List", description: "Course list" },
      { id: "featured", name: "Featured", description: "Featured courses" },
    ],
    defaultContent: defaultCourseCardsContent,
  },
  "book-showcase": {
    type: "book-showcase",
    name: "Book Showcase",
    description: "Book/ebook showcase",
    category: "ecommerce",
    icon: "book",
    variants: [
      { id: "grid", name: "Grid", description: "Book grid" },
      { id: "featured", name: "Featured", description: "Featured book" },
      { id: "carousel", name: "Carousel", description: "Book carousel" },
    ],
    defaultContent: defaultBookShowcaseContent,
  },
  // Content Listing sections
  "all-courses-listing": {
    type: "all-courses-listing",
    name: "All Courses",
    description: "Display all published courses",
    category: "ecommerce",
    icon: "graduation-cap",
    variants: [
      { id: "scroll", name: "Scroll", description: "Horizontal scroll with arrow navigation" },
      { id: "grid", name: "Grid", description: "Responsive grid layout" },
      { id: "row", name: "Row", description: "Centered horizontal row" },
    ],
    defaultContent: defaultAllCoursesListingContent,
  },
  "self-paced-courses-listing": {
    type: "self-paced-courses-listing",
    name: "Self-Paced Courses",
    description: "Display self-paced courses",
    category: "ecommerce",
    icon: "play-circle",
    variants: [
      { id: "scroll", name: "Scroll", description: "Horizontal scroll with arrow navigation" },
      { id: "grid", name: "Grid", description: "Responsive grid layout" },
      { id: "row", name: "Row", description: "Centered horizontal row" },
    ],
    defaultContent: defaultSelfPacedCoursesListingContent,
  },
  "books-listing": {
    type: "books-listing",
    name: "Books",
    description: "Display published books",
    category: "ecommerce",
    icon: "book-open",
    variants: [
      { id: "scroll", name: "Scroll", description: "Horizontal scroll with arrow navigation" },
      { id: "grid", name: "Grid", description: "Responsive grid layout" },
      { id: "row", name: "Row", description: "Centered horizontal row" },
    ],
    defaultContent: defaultBooksListingContent,
  },
  "bundles-listing": {
    type: "bundles-listing",
    name: "Bundles",
    description: "Display course and book bundles",
    category: "ecommerce",
    icon: "package",
    variants: [
      { id: "scroll", name: "Scroll", description: "Horizontal scroll with arrow navigation" },
      { id: "grid", name: "Grid", description: "Responsive grid layout" },
      { id: "row", name: "Row", description: "Centered horizontal row" },
    ],
    defaultContent: defaultBundlesListingContent,
  },
  "categories-listing": {
    type: "categories-listing",
    name: "Categories",
    description: "Display course and book categories",
    category: "ecommerce",
    icon: "grid-3x3",
    variants: [
      { id: "scroll", name: "Scroll", description: "Horizontal scroll with arrow navigation" },
      { id: "grid", name: "Grid", description: "Responsive grid layout" },
      { id: "row", name: "Row", description: "Centered horizontal row" },
    ],
    defaultContent: defaultCategoriesListingContent,
  },
  "test-series-listing": {
    type: "test-series-listing",
    name: "Test Series",
    description: "Display published test series",
    category: "ecommerce",
    icon: "clipboard-check",
    variants: [
      { id: "scroll", name: "Scroll", description: "Horizontal scroll with arrow navigation" },
      { id: "grid", name: "Grid", description: "Responsive grid layout" },
      { id: "row", name: "Row", description: "Centered horizontal row" },
    ],
    defaultContent: defaultTestSeriesListingContent,
  },

  // Course Page Sections
  "course-hero": {
    type: "course-hero",
    name: "Course Hero",
    description: "Course page hero with thumbnail, pricing and CTA",
    category: "course",
    icon: "graduation-cap",
    variants: [
      { id: "modern", name: "Modern", description: "Modern gradient hero" },
      { id: "classic", name: "Classic", description: "Traditional layout" },
      { id: "minimal", name: "Minimal", description: "Clean, minimal design" },
    ],
    defaultContent: {
      title: "Course Title",
      subtitle: "Learn essential skills with this comprehensive course",
      thumbnail: "",
      mode: "SELF_PACED",
      duration: "20 hours",
      language: "English",
      rating: 4.8,
      studentsCount: 5000,
      price: 4999,
      currency: "INR",
      enrollCta: { text: "Enroll Now", href: "/login", variant: "primary" as const },
      category: "Development",
    },
  },
  "course-curriculum": {
    type: "course-curriculum",
    name: "Course Curriculum",
    description: "Collapsible course syllabus sections",
    category: "course",
    icon: "list-tree",
    variants: [
      { id: "accordion", name: "Accordion", description: "Expandable sections" },
      { id: "simple", name: "Simple", description: "Basic list view" },
    ],
    defaultContent: {
      headline: "Course Curriculum",
      subheadline: "What you'll learn in this course",
      totalLectures: 50,
      totalDuration: "20 hours",
      sections: [],
    },
  },
  "course-offerings": {
    type: "course-offerings",
    name: "Course Offerings",
    description: "What's included in the course",
    category: "course",
    icon: "package",
    variants: [
      { id: "grid", name: "Grid", description: "Icon grid layout" },
      { id: "list", name: "List", description: "Vertical list" },
      { id: "compact", name: "Compact", description: "Compact horizontal" },
    ],
    defaultContent: {
      headline: "This Course Includes",
      offerings: [],
    },
  },
  "course-recommendations": {
    type: "course-recommendations",
    name: "Course Recommendations",
    description: "Recommended related courses",
    category: "course",
    icon: "book-open",
    variants: [{ id: "default", name: "Default", description: "Grid of recommended courses" }],
    defaultContent: {
      headline: "You May Also Like",
      recommendations: [],
    },
  },
  "course-instructor": {
    type: "course-instructor",
    name: "Course Instructor",
    description: "Instructor profile card(s)",
    category: "course",
    icon: "user-circle",
    variants: [
      { id: "card", name: "Card", description: "Profile card" },
      { id: "detailed", name: "Detailed", description: "Full bio card" },
      { id: "compact", name: "Compact", description: "Minimal profile" },
    ],
    defaultContent: {
      headline: "Meet Your Instructor",
      instructors: [],
    },
  },
  "course-prerequisites": {
    type: "course-prerequisites",
    name: "Course Prerequisites",
    description: "Requirements before starting the course",
    category: "course",
    icon: "clipboard-list",
    variants: [
      { id: "list", name: "List", description: "Simple list" },
      { id: "compact", name: "Compact", description: "Compact layout" },
    ],
    defaultContent: {
      headline: "Requirements",
      prerequisites: [],
    },
  },
  "course-learning-outcomes": {
    type: "course-learning-outcomes",
    name: "Learning Outcomes",
    description: "What students will learn",
    category: "course",
    icon: "check-circle",
    variants: [
      { id: "grid", name: "Grid", description: "Two-column grid" },
      { id: "list", name: "List", description: "Vertical list" },
      { id: "compact", name: "Compact", description: "Compact layout" },
    ],
    defaultContent: {
      headline: "What You'll Learn",
      outcomes: [],
    },
  },

  // Book Page Sections (used by admin book editor; minimal registry for type completeness)
  "book-hero": {
    type: "book-hero",
    name: "Book Hero",
    description: "Book title and metadata",
    category: "content",
    icon: "book",
    variants: [{ id: "default", name: "Default", description: "Default book hero" }],
    defaultContent: {},
  },
  "book-description": {
    type: "book-description",
    name: "Book Description",
    description: "Book description section",
    category: "content",
    icon: "file-text",
    variants: [{ id: "default", name: "Default", description: "Default description" }],
    defaultContent: {},
  },
  "book-offerings": {
    type: "book-offerings",
    name: "Book Offerings",
    description: "What's included in the book",
    category: "content",
    icon: "list-checks",
    variants: [{ id: "default", name: "Default", description: "Default offerings" }],
    defaultContent: {},
  },
  "book-author": {
    type: "book-author",
    name: "Book Author",
    description: "Author(s) section",
    category: "content",
    icon: "user",
    variants: [{ id: "default", name: "Default", description: "Default author" }],
    defaultContent: {},
  },
  "book-recommendations": {
    type: "book-recommendations",
    name: "Book Recommendations",
    description: "More books you might like",
    category: "content",
    icon: "library",
    variants: [{ id: "default", name: "Default", description: "Recommended books" }],
    defaultContent: {},
  },

  // ── About Us Page Sections ──

  "about-us-hero": {
    type: "about-us-hero",
    name: "About Us: Hero",
    description: "Hero section with headline, description, and key stats",
    category: "content",
    icon: "info",
    variants: [{ id: "default", name: "Default", description: "Centered hero with stats row" }],
    defaultContent: {
      headline: "About",
      highlightText: "Us",
      description:
        "Your gateway to affordable, high-quality education in emerging technologies. We prioritize making education accessible without compromising excellence. Our industry-expert crafted programs ensure learners receive practical, real-world skills.",
      stats: [
        { id: "stat-1", value: "50+", label: "Expert Courses" },
        { id: "stat-2", value: "10K+", label: "Active Learners" },
        { id: "stat-3", value: "95%", label: "Satisfaction Rate" },
      ],
    } satisfies AboutUsHeroContent,
  },
  "about-us-mission": {
    type: "about-us-mission",
    name: "About Us: Mission",
    description: "Two-column mission and who-we-are blocks on dark background",
    category: "content",
    icon: "target",
    variants: [{ id: "default", name: "Default", description: "Two-column dark layout" }],
    defaultContent: {
      blocks: [
        {
          id: "block-1",
          label: "Our Mission",
          title: "Democratizing education for everyone, everywhere",
          description:
            "Our mission is to democratize education and make high-quality learning accessible and affordable to everyone, everywhere. We believe that education is a powerful tool for personal and professional growth, and we strive to provide comprehensive upskilling courses in both tech and non-tech areas to help individuals achieve their goals.",
        },
        {
          id: "block-2",
          label: "Who We Are",
          title: "Passionate educators & technologists",
          description:
            "We are dedicated to delivering world-class education and training. Our team comprises passionate educators, industry experts, and technologists who work tirelessly to create and deliver content that is not only informative but also engaging and impactful.",
        },
      ],
    } satisfies AboutUsMissionContent,
  },
  "about-us-offerings": {
    type: "about-us-offerings",
    name: "About Us: Offerings",
    description: "Three-column cards showcasing what you offer, with tags",
    category: "content",
    icon: "monitor",
    variants: [{ id: "default", name: "Default", description: "Three-column card grid" }],
    defaultContent: {
      headline: "What We Offer",
      description:
        "We offer a wide range of courses across various domains. Designed to be affordable without compromising on quality, ensuring learners from all backgrounds can benefit.",
      offerings: [
        {
          id: "offering-1",
          icon: "code",
          title: "Tech Courses",
          description:
            "Master in-demand technical skills with hands-on projects and expert mentorship.",
          tags: ["Programming", "Web Dev", "Data Science", "AI / ML"],
        },
        {
          id: "offering-2",
          icon: "book-open",
          title: "Non-Tech Courses",
          description: "Build essential professional and creative skills for career growth.",
          tags: ["Digital Marketing", "Creative Writing", "Personal Dev", "Project Mgmt"],
        },
        {
          id: "offering-3",
          icon: "briefcase",
          title: "Corporate Training",
          description:
            "Customized training solutions for businesses to upskill their entire workforce.",
          tags: ["Team Upskilling", "Custom Paths", "Analytics"],
        },
      ],
    } satisfies AboutUsOfferingsContent,
  },
  "about-us-values": {
    type: "about-us-values",
    name: "About Us: Values",
    description: "Four-column value cards highlighting core values",
    category: "content",
    icon: "heart",
    variants: [{ id: "default", name: "Default", description: "Four-column card grid" }],
    defaultContent: {
      headline: "Our Values",
      description:
        "Our values guide our decisions, shape our culture, and help us deliver on our mission.",
      values: [
        {
          id: "value-1",
          icon: "globe",
          title: "Accessibility",
          description:
            "Education should be accessible to everyone, regardless of their financial or geographical barriers.",
        },
        {
          id: "value-2",
          icon: "check-circle",
          title: "Quality",
          description:
            "We are committed to delivering high-quality content that is relevant, practical, and engaging.",
        },
        {
          id: "value-3",
          icon: "zap",
          title: "Innovation",
          description:
            "We continuously innovate to enhance the learning experience and stay ahead of industry trends.",
        },
        {
          id: "value-4",
          icon: "users",
          title: "Community",
          description:
            "We foster a supportive community of learners and educators who collaborate and grow together.",
        },
      ],
    } satisfies AboutUsValuesContent,
  },
  "about-us-contact": {
    type: "about-us-contact",
    name: "About Us: Contact",
    description: "Contact call-to-action box with email",
    category: "conversion",
    icon: "mail",
    variants: [{ id: "default", name: "Default", description: "Dark contact box with email" }],
    defaultContent: {
      label: "Contact Us",
      headline: "Questions? We're here to help.",
      description:
        "If you have any questions, feedback, or need support, feel free to reach out to us. We are here to help you on your learning journey.",
      email: "contact@example.com",
      emailLabel: "Email us at",
    } satisfies AboutUsContactContent,
  },

  // ── Contact Us Page Sections ──

  "contact-us-hero": {
    type: "contact-us-hero",
    name: "Contact Us: Hero",
    description: "Hero section with headline and description",
    category: "hero",
    icon: "mail",
    variants: [{ id: "default", name: "Default", description: "Centered hero" }],
    defaultContent: {
      headline: "Get in",
      highlightText: "Touch",
      description:
        "Have questions about our courses or programs? We'd love to hear from you. Let's start a conversation.",
    } satisfies ContactUsHeroContent,
  },

  "contact-us-info": {
    type: "contact-us-info",
    name: "Contact Us: Info Cards",
    description: "Contact info cards with email, phone, and address",
    category: "content",
    icon: "contact",
    variants: [{ id: "default", name: "Default", description: "Three-column cards" }],
    defaultContent: {
      cards: [
        {
          id: "1",
          icon: "mail",
          title: "Email Us",
          detail: "hello@example.com",
          subtext: "We reply within 24 hours",
        },
        {
          id: "2",
          icon: "phone",
          title: "Call Us",
          detail: "+1 (888) 456-7890",
          subtext: "Mon-Sat, 9AM-8PM",
        },
        {
          id: "3",
          icon: "map-pin",
          title: "Visit Us",
          detail: "123 Knowledge Park",
          subtext: "Your City, Country",
        },
      ],
    } satisfies ContactUsInfoContent,
  },

  "contact-us-form": {
    type: "contact-us-form",
    name: "Contact Us: Form",
    description: "Contact form with illustration and FAQ",
    category: "conversion",
    icon: "send",
    variants: [{ id: "default", name: "Default", description: "Form with FAQ sidebar" }],
    defaultContent: {
      formHeadline: "Send us a message",
      formDescription: "Fill out the form and our team will get back to you within 24 hours.",
      fields: [
        {
          id: "1",
          name: "name",
          label: "Full Name",
          type: "text",
          placeholder: "John Doe",
          required: true,
          halfWidth: true,
        },
        {
          id: "2",
          name: "email",
          label: "Email Address",
          type: "email",
          placeholder: "john@example.com",
          required: true,
          halfWidth: true,
        },
        {
          id: "3",
          name: "phone",
          label: "Phone Number",
          type: "tel",
          placeholder: "+91 98765 43210",
          halfWidth: true,
        },
        {
          id: "4",
          name: "subject",
          label: "Subject",
          type: "select",
          placeholder: "Select a subject",
          options: [
            "Course Inquiry",
            "Private Tuition",
            "Pricing & Plans",
            "Technical Support",
            "Partnership",
            "Other",
          ],
          halfWidth: true,
        },
        {
          id: "5",
          name: "message",
          label: "Your Message",
          type: "textarea",
          placeholder: "Tell us how we can help you...",
          required: true,
        },
      ],
      submitText: "Send Message",
      successHeadline: "Message Sent!",
      successMessage: "Thanks for reaching out. Our team will get back to you within 24 hours.",
      illustrationHeadline: "We're Always Here for You",
      illustrationDescription:
        "Whether you need guidance picking the right course or support with your learning journey, our team has your back.",
      illustrationStats: [
        { id: "1", value: "<2hr", label: "Avg Reply" },
        { id: "2", value: "24/7", label: "Support" },
        { id: "3", value: "98%", label: "Satisfied" },
      ],
      faqHeadline: "Quick Answers",
      faqs: [
        {
          id: "1",
          question: "How do I enroll in a course?",
          answer:
            "Browse our catalog, pick your course, and click 'Enroll Now'. You can pay online and start learning immediately.",
        },
        {
          id: "2",
          question: "Do you offer live sessions?",
          answer:
            "Yes! We offer 1-on-1 and group live sessions with expert tutors across all subjects.",
        },
        {
          id: "3",
          question: "Can I get a refund?",
          answer:
            "Absolutely. We offer a 7-day money-back guarantee on all courses if you're not satisfied.",
        },
        {
          id: "4",
          question: "Are certificates provided?",
          answer: "Yes, all our courses come with a verified digital certificate upon completion.",
        },
      ],
    } satisfies ContactUsFormContent,
  },

  // ── FAQ Page Sections ──

  "faq-us-hero": {
    type: "faq-us-hero",
    name: "FAQ: Hero",
    description: "Hero section with headline and description",
    category: "hero",
    icon: "help-circle",
    variants: [{ id: "default", name: "Default", description: "Centered hero" }],
    defaultContent: {
      headline: "Frequently Asked",
      highlightText: "Questions",
      description:
        "Everything you need to know about our courses, programs, and how we can help you succeed.",
    } satisfies FaqUsHeroContent,
  },

  "faq-us-list": {
    type: "faq-us-list",
    name: "FAQ: List",
    description: "Accordion FAQ list with expandable answers",
    category: "content",
    icon: "list",
    variants: [{ id: "default", name: "Default", description: "Simple accordion" }],
    defaultContent: {
      items: [
        {
          id: "1",
          question: "How do I enroll in a course?",
          answer:
            "Simply browse our course catalog, choose the course that fits your goals, and click 'Enroll Now.' You can pay securely online and get instant access to start learning right away.",
        },
        {
          id: "2",
          question: "Are the courses self-paced or scheduled?",
          answer:
            "We offer both! Most of our pre-recorded courses are completely self-paced. For live classes and tuition sessions, you'll choose a schedule that works with your calendar.",
        },
        {
          id: "3",
          question: "Do I get a certificate after completing a course?",
          answer:
            "Yes! Every course comes with a verified digital certificate upon completion. You can share it on LinkedIn, add it to your resume, or download it as a PDF.",
        },
        {
          id: "4",
          question: "Can I access course materials after the course ends?",
          answer:
            "Absolutely. Once you enroll, you get lifetime access to all course materials including videos, notes, quizzes, and downloadable resources.",
        },
        {
          id: "5",
          question: "How do live tuition sessions work?",
          answer:
            "Our live sessions connect you with expert tutors via video call. You can book 1-on-1 or small group sessions. Each session is interactive with real-time Q&A and screen sharing.",
        },
        {
          id: "6",
          question: "What payment methods do you accept?",
          answer:
            "We accept all major credit and debit cards, UPI, net banking, and popular wallets. International students can pay via PayPal. EMI options are also available on select courses.",
        },
        {
          id: "7",
          question: "Do you offer a refund policy?",
          answer:
            "Yes, we offer a 7-day money-back guarantee on all courses. If you're not satisfied within the first 7 days, simply request a refund. No questions asked.",
        },
        {
          id: "8",
          question: "Are there any free courses or trials?",
          answer:
            "Yes! We offer a selection of free introductory courses across all categories. Plus, most paid courses include a free preview of the first few lessons.",
        },
        {
          id: "9",
          question: "What devices can I use to access courses?",
          answer:
            "Learn on any device, laptop, tablet, or smartphone. Our platform is fully responsive and works on all modern browsers with offline download support.",
        },
        {
          id: "10",
          question: "How do I contact customer support?",
          answer:
            "You can reach us via email, phone, or the live chat on our website. We also have a Contact Us page where you can submit a detailed message. Average response time is under 2 hours.",
        },
      ],
    } satisfies FaqUsListContent,
  },

  // ── Privacy Policy Page Sections ──

  "privacy-us-hero": {
    type: "privacy-us-hero",
    name: "Privacy: Hero",
    description: "Hero section with headline, description, and last updated date",
    category: "hero",
    icon: "shield",
    variants: [{ id: "default", name: "Default", description: "Centered hero" }],
    defaultContent: {
      headline: "Privacy",
      highlightText: "Policy",
      description:
        "Your privacy is our highest priority. Here's how we collect, use, and protect your personal information.",
      lastUpdated: "March 15, 2026",
      version: "2.1",
    } satisfies PrivacyUsHeroContent,
  },

  "privacy-us-content": {
    type: "privacy-us-content",
    name: "Privacy: Content",
    description: "Policy sections with icons, titles, and body text",
    category: "content",
    icon: "file-text",
    variants: [{ id: "default", name: "Default", description: "Card-based sections" }],
    defaultContent: {
      sections: [
        {
          id: "1",
          icon: "shield-check",
          title: "Introduction",
          body: "Your privacy is our highest priority. This Privacy Policy explains how we collect, use, store, and protect your personal information when you use our applications, websites, and services. We are committed to ensuring that your data remains secure and is used exclusively to provide and enhance your experience. By using our Services, you confirm that you have read, understood, and agreed to this Privacy Policy.",
        },
        {
          id: "2",
          icon: "clipboard-check",
          title: "Applicability of this Policy",
          body: "This Privacy Policy applies to all data collected through our Services. It governs how your data is processed, stored, and managed. Please note that this policy is limited to our operations and does not cover third-party websites or services that may be linked to our Services.",
        },
        {
          id: "3",
          icon: "archive",
          title: "Information We Collect",
          body: "We only collect information necessary to provide you with access to our Services. This includes personal information (name, email, phone number) for account registration, usage information (features used, device info, IP address), and any feedback or suggestions you provide. We do not collect sensitive personal data such as financial information, health data, or biometric data.",
        },
        {
          id: "4",
          icon: "lightbulb",
          title: "Use of Your Information",
          body: "We use your information solely to: provide access to our Services and ensure smooth operation, personalize your experience and deliver relevant content, respond to your inquiries and provide customer support, and improve our Services through feedback and usage analytics. We do not share your data with third parties under any circumstances.",
        },
        {
          id: "5",
          icon: "lock",
          title: "Data Security",
          body: "We use industry-standard security measures to protect your data from unauthorized access, misuse, or disclosure. This includes encryption of all data during transmission and storage, regular security audits and vulnerability scans, and secure servers protected by firewalls. While we take every precaution, no system is completely foolproof. You are responsible for maintaining the confidentiality of your account credentials.",
        },
        {
          id: "6",
          icon: "clock",
          title: "Data Retention & Deletion",
          body: "Your data is retained for as long as your account remains active. Upon receiving a deletion request, your account will be marked for deletion and permanently removed after 30 days. Residual data such as backups and system logs will be securely purged within 30 days. You can delete your account from your profile settings or contact us to request deletion.",
        },
        {
          id: "7",
          icon: "fingerprint",
          title: "Cookies & Tracking",
          body: "We use cookies and similar technologies to enhance functionality and performance, and to provide a seamless user experience by remembering your preferences. You can disable cookies through your browser settings, but this may affect some features. We do not use cookies for advertising or tracking purposes, and no data collected via cookies is shared with third parties.",
        },
        {
          id: "8",
          icon: "user",
          title: "Your Rights",
          body: "As a user, you have the right to: access a copy of your data, correct inaccurate or incomplete information, permanently delete your account and all associated data, object to processing for specific purposes, and request your data in a machine-readable format (data portability). To exercise any of these rights, please contact us.",
        },
        {
          id: "9",
          icon: "users",
          title: "Data Sharing",
          body: "We do not share, sell, rent, or disclose your personal data to any third party under any circumstances. Your data is used solely within our platform for purposes directly related to the operation and improvement of our Services.",
        },
        {
          id: "10",
          icon: "heart",
          title: "Children's Privacy",
          body: "Our Services are intended for users aged 18 and above. If you are under 18, you may use our Services only with the consent of a parent or legal guardian. If we become aware of any data collected from a minor without proper consent, we will delete it immediately.",
        },
        {
          id: "11",
          icon: "pen-line",
          title: "Updates to This Policy",
          body: "We may update this Privacy Policy periodically to reflect changes in our practices or to comply with legal requirements. Any updates will be posted on this page, and we recommend reviewing the policy regularly. If you have questions about this policy, feel free to contact us, we're happy to help.",
        },
      ],
    } satisfies PrivacyUsContentContent,
  },

  // ── Terms of Service Page Sections ──

  "terms-us-hero": {
    type: "terms-us-hero",
    name: "Terms: Hero",
    description: "Hero section with headline and description",
    category: "hero",
    icon: "file-text",
    variants: [{ id: "default", name: "Default", description: "Centered hero" }],
    defaultContent: {
      headline: "Terms of",
      highlightText: "Service",
      description:
        "Please review these terms carefully, they outline your rights, responsibilities, and how our platform works.",
    } satisfies TermsUsHeroContent,
  },

  "terms-us-content": {
    type: "terms-us-content",
    name: "Terms: Content",
    description: "Numbered terms sections with titles and body text",
    category: "content",
    icon: "list-ordered",
    variants: [{ id: "default", name: "Default", description: "Numbered card sections" }],
    defaultContent: {
      introText:
        "These Terms of Use constitute an enforceable contract between you and us. By accessing or using our website, mobile applications, and related services, you agree to be bound by these Terms. They contain important information about your legal rights, remedies, and obligations.",
      sections: [
        {
          id: "1",
          title: "Accounts",
          body: "You need an account for most activities on our platform. Keep your password somewhere safe because you're responsible for all activity associated with your account. If you suspect someone else is using your account, let us know by contacting our Support Team. You must have reached the age of consent for online services in your country to use our platform.",
        },
        {
          id: "2",
          title: "Communications",
          body: "By creating an account, you grant us permission to contact you regarding important platform communications, updates, and relevant information about our services. You maintain the right to unsubscribe from our email communications at any time. Even if you opt out of marketing, you may still receive essential account-related and transaction notifications.",
        },
        {
          id: "3",
          title: "Content Enrollment & Access",
          body: "When you enroll in a course or other content, you get a license from us to view it via our Services and no other use. Don't try to transfer or resell content in any way.",
        },
        {
          id: "4",
          title: "Payments & Refunds",
          body: "When you make a payment, you agree to use a valid payment method. We put a lot of effort to bring our content to the world, and we are one of the most affordable platforms for learning. All payments are final, please review your selection carefully before completing a purchase.",
        },
        {
          id: "5",
          title: "Digital Product Access",
          body: "Upon successful payment, you will receive access to the purchased digital content immediately. A confirmation email with access instructions will be sent to your registered email address. Access to the content will last for the duration specified at the time of purchase. Your payment information is securely processed, and we do not store your payment details on our servers.",
        },
        {
          id: "6",
          title: "Content & Behavior Rules",
          body: "You can only use our platform for lawful purposes. You're responsible for all the content that you post on our platform. We reserve the right to remove content or suspend accounts that violate community guidelines or applicable laws.",
        },
        {
          id: "7",
          title: "Rights to Content You Post",
          body: "You retain ownership of content you post to our platform, including your courses. By posting content, you allow us to reuse and share it, but you do not lose any ownership rights you may have over your original work.",
        },
        {
          id: "8",
          title: "Using at Your Own Risk",
          body: "You use our platform at your own risk. We are not responsible for any harm or damage that may result from using our platform. We provide our services on an 'as is' and 'as available' basis without warranties of any kind.",
        },
        {
          id: "9",
          title: "Platform Rights",
          body: "We own the platform and Services, including the website, applications, APIs, and content created by our employees. You can't tamper with or use them without authorization.",
        },
        {
          id: "10",
          title: "Subscription Terms",
          body: "Additional terms apply to subscription-based collections. Subscriptions automatically renew unless cancelled before the renewal date. You can manage or cancel your subscription from your account settings at any time.",
        },
        {
          id: "11",
          title: "Miscellaneous Legal Terms",
          body: "These Terms are like any other contract and they have important legal terms that protect us and clarify the legal relationship between us and you. If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in full force and effect.",
        },
        {
          id: "12",
          title: "Dispute Resolution",
          body: "If there's a dispute, our Support Team is happy to help resolve the issue. We encourage you to contact us first before pursuing any formal legal action, and we'll work together to find a fair resolution.",
        },
        {
          id: "13",
          title: "Updating These Terms",
          body: "From time to time, we may update these Terms to clarify our practices or to reflect new or different practices. If we make any material change, we will notify you using prominent means such as email or a banner on our platform. If you have questions about these terms, contact us, our support team is here to help.",
        },
      ],
    } satisfies TermsUsContentContent,
  },

  // ============================================
  // Photography Landing Page Sections
  // ============================================

  "hero-photography": {
    type: "hero-photography",
    name: "Hero: Photography",
    description:
      "Neo-brutalist full-screen hero with dramatic image, bold typography, CTA buttons, and stats",
    category: "hero",
    icon: "camera",
    variants: [
      { id: "default", name: "Default", description: "Full-bleed hero with overlay and stats" },
    ],
    defaultContent: {
      headline: "Master the\nArt of Light",
      headlineAccent: "",
      description: "Transform your passion into profession with expert-led photography courses",
      primaryCta: { text: "Enroll Now", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "Gallery", href: "#section-gallery-photography-5", variant: "outline" },
      image: "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=1400&q=80",
      imageAlt: "Professional photographer in studio with dramatic lighting",
      stats: [
        { id: "1", value: "12K+", label: "Students" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "50+", label: "Courses" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-cooking": {
    type: "hero-cooking",
    name: "Hero: Cooking",
    description: "Warm split-layout culinary hero with dish image, category pills, CTAs and stats",
    category: "hero",
    icon: "chef-hat",
    variants: [
      { id: "default", name: "Default", description: "Split hero with food image and stats" },
    ],
    defaultContent: {
      headline: "Cook Like a Pro,\nFrom Your Kitchen",
      headlineAccent: "",
      description: "Learn recipes, techniques and the business of food from expert chefs, at your own pace.",
      primaryCta: { text: "Explore Courses", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "Watch a Class", href: "#section-all-courses-listing-1", variant: "outline" },
      image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1000&q=80",
      imageAlt: "Beautifully plated gourmet dish",
      stats: [
        { id: "1", value: "300+", label: "Recipes" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "25K+", label: "Home Chefs" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "recipes-cooking": {
    type: "recipes-cooking",
    name: "Recipes: Cooking",
    description: "Animated 3D showcase of signature recipes with category, time and difficulty",
    category: "content",
    icon: "utensils-crossed",
    variants: [
      { id: "default", name: "Default", description: "3D tilt recipe cards grid" },
    ],
    defaultContent: {
      headline: "Recipes You'll Love to Master",
      subheadline: "Step-by-step lessons for dishes from every cuisine and skill level.",
      items: [
        { id: "r1", title: "Artisan Sourdough", category: "Baking", time: "6 hrs", level: "Intermediate", image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80" },
        { id: "r2", title: "Wood-Fired Pizza", category: "World Cuisine", time: "45 min", level: "Beginner", image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80" },
        { id: "r3", title: "French Macarons", category: "Pastry", time: "2 hrs", level: "Advanced", image: "https://images.unsplash.com/photo-1569864358642-9d1684040f43?w=800&q=80" },
        { id: "r4", title: "Grilled Salmon", category: "Grilling", time: "25 min", level: "Beginner", image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&q=80" },
        { id: "r5", title: "Buddha Bowl", category: "Vegan", time: "30 min", level: "Beginner", image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80" },
        { id: "r6", title: "Classic Tiramisu", category: "Pastry", time: "1 hr", level: "Intermediate", image: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800&q=80" },
      ],
    } satisfies RecipesCookingContent,
  },

  "features-cooking": {
    type: "features-cooking",
    name: "Features: Cooking",
    description: "Animated feature cards with a floating food-icon motif, tuned for cooking academies",
    category: "features",
    icon: "chef-hat",
    variants: [{ id: "default", name: "Default", description: "Animated feature grid" }],
    defaultContent: {
      headline: "Everything You Need to Cook Like a Pro",
      subheadline: "Real kitchens, real techniques, and mentors who've cooked at the highest level.",
      items: [
        { id: "f1", icon: "chef", title: "Chef-Led Classes", description: "Learn directly from professional chefs and restaurateurs." },
        { id: "f2", icon: "utensils", title: "Hands-On Recipes", description: "Cook along with step-by-step, tested recipes." },
        { id: "f3", icon: "flame", title: "Technique First", description: "Master knife skills, heat control and plating." },
        { id: "f4", icon: "leaf", title: "Every Cuisine", description: "From regional classics to modern plant-based." },
        { id: "f5", icon: "clock", title: "Learn at Your Pace", description: "Lifetime access to every lesson and recipe." },
        { id: "f6", icon: "award", title: "Get Certified", description: "Earn a certificate to showcase your craft." },
      ],
    } satisfies NicheFeaturesContent,
  },

  "testimonials-cooking": {
    type: "testimonials-cooking",
    name: "Testimonials: Cooking",
    description: "3D-tilt testimonial cards with ratings, tuned for cooking academies",
    category: "social-proof",
    icon: "chef-hat",
    variants: [{ id: "default", name: "Default", description: "Testimonial card grid" }],
    defaultContent: {
      headline: "Loved by Home Cooks Everywhere",
      subheadline: "Thousands have found their confidence in the kitchen with us.",
      items: [
        { id: "t1", name: "Priya Sharma", role: "Home Baker", quote: "I went from burning toast to baking sourdough my family fights over. The lessons are so easy to follow.", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80", rating: 5 },
        { id: "t2", name: "Marcus Lee", role: "Weekend Chef", quote: "The knife-skills module alone was worth it. My prep is twice as fast and my plating looks restaurant-grade.", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80", rating: 5 },
        { id: "t3", name: "Aisha Khan", role: "Food Blogger", quote: "Every cuisine I wanted to learn is here, taught by chefs who actually cook it. Absolutely worth it.", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80", rating: 5 },
      ],
    } satisfies NicheTestimonialsContent,
  },

  "cta-cooking": {
    type: "cta-cooking",
    name: "CTA: Cooking",
    description: "Warm gradient call-to-action with a floating food-icon motif, tuned for cooking academies",
    category: "conversion",
    icon: "chef-hat",
    variants: [{ id: "default", name: "Default", description: "Gradient CTA banner" }],
    defaultContent: {
      headline: "Ready to Cook Something Amazing?",
      subheadline: "Join thousands of home cooks learning to create dishes they're proud of.",
      primaryCta: { text: "Start Cooking", href: "/all-courses" },
      secondaryCta: { text: "Browse Recipes", href: "#section-recipes-cooking-1" },
    } satisfies NicheCtaContent,
  },

  "hero-fitness": {
    type: "hero-fitness",
    name: "Hero: Fitness",
    description: "Bold full-bleed fitness hero with animated energy streaks, pulsing stats and dual CTA",
    category: "hero",
    icon: "dumbbell",
    variants: [{ id: "default", name: "Default", description: "Full-bleed energetic hero" }],
    defaultContent: {
      headline: "Train Harder.\nAchieve More.",
      headlineAccent: "",
      description: "Online fitness, sports and coaching programs built to get you real results, at your pace.",
      primaryCta: { text: "Start Training", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "Watch Intro", href: "#section-all-courses-listing-2", variant: "outline" },
      image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1400&q=80",
      imageAlt: "Athlete training in a modern gym",
      stats: [
        { id: "1", value: "50K+", label: "Members" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "120+", label: "Programs" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "programs-fitness": {
    type: "programs-fitness",
    name: "Programs: Fitness",
    description: "Animated 3D grid of training programs with level, duration and session count",
    category: "content",
    icon: "dumbbell",
    variants: [{ id: "default", name: "Default", description: "3D tilt program cards grid" }],
    defaultContent: {
      headline: "Programs Built for Every Goal",
      subheadline: "Structured plans for strength, endurance and mobility, coached from day one.",
      items: [
        { id: "p1", title: "Strength Foundations", level: "Beginner", duration: "8 weeks", sessions: "24 sessions", image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80" },
        { id: "p2", title: "HIIT Shred", level: "Intermediate", duration: "6 weeks", sessions: "30 sessions", image: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=800&q=80" },
        { id: "p3", title: "Marathon Prep", level: "Advanced", duration: "16 weeks", sessions: "48 sessions", image: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&q=80" },
        { id: "p4", title: "Mobility & Recovery", level: "All Levels", duration: "4 weeks", sessions: "20 sessions", image: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80" },
        { id: "p5", title: "Powerlifting", level: "Advanced", duration: "12 weeks", sessions: "36 sessions", image: "https://images.unsplash.com/photo-1534368420009-621bfab424a8?w=800&q=80" },
        { id: "p6", title: "Yoga Flow", level: "Beginner", duration: "6 weeks", sessions: "24 sessions", image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80" },
      ],
    } satisfies ProgramsFitnessContent,
  },

  "hero-music": {
    type: "hero-music",
    name: "Hero: Music",
    description: "Dark studio hero with glowing orbs, floating notes and an animated equalizer bar row",
    category: "hero",
    icon: "music",
    variants: [{ id: "default", name: "Default", description: "Centered dark studio hero" }],
    defaultContent: {
      headline: "Find Your Sound",
      headlineAccent: "",
      description: "Learn instruments, production and performance from working musicians and producers.",
      primaryCta: { text: "Start Learning", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "Listen", href: "#section-all-courses-listing-2", variant: "outline" },
      image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1400&q=80",
      imageAlt: "Music production studio",
      stats: [
        { id: "1", value: "20K+", label: "Students" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "80+", label: "Courses" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "genres-music": {
    type: "genres-music",
    name: "Genres: Music",
    description: "Animated equalizer-accented grid of genres and instruments with track counts",
    category: "content",
    icon: "music",
    variants: [{ id: "default", name: "Default", description: "3D tilt genre cards with equalizer" }],
    defaultContent: {
      headline: "Explore Every Genre",
      subheadline: "From classical technique to modern production, find the path that moves you.",
      items: [
        { id: "g1", title: "Guitar", tracks: "48 lessons", level: "All Levels", image: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800&q=80" },
        { id: "g2", title: "Piano", tracks: "62 lessons", level: "All Levels", image: "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=800&q=80" },
        { id: "g3", title: "Music Production", tracks: "40 lessons", level: "Intermediate", image: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=800&q=80" },
        { id: "g4", title: "Vocals", tracks: "35 lessons", level: "Beginner", image: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=800&q=80" },
        { id: "g5", title: "Drums", tracks: "28 lessons", level: "All Levels", image: "https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=800&q=80" },
        { id: "g6", title: "DJ & Mixing", tracks: "22 lessons", level: "Intermediate", image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&q=80" },
      ],
    } satisfies GenresMusicContent,
  },

  "hero-business": {
    type: "hero-business",
    name: "Hero: Business",
    description: "Professional split hero with a floating dashboard frame and bobbing metric cards",
    category: "hero",
    icon: "trending-up",
    variants: [{ id: "default", name: "Default", description: "Split hero with dashboard mockup" }],
    defaultContent: {
      headline: "Upskill Your Team, at Scale",
      headlineAccent: "",
      description: "Corporate training, certifications and analytics on one branded platform your teams will actually use.",
      primaryCta: { text: "Book a Demo", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "Explore Courses", href: "#section-all-courses-listing-2", variant: "outline" },
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1400&q=80",
      imageAlt: "Analytics dashboard",
      stats: [
        { id: "1", value: "98%", label: "Completion" },
        { id: "2", value: "3.4x", label: "ROI" },
        { id: "3", value: "500+", label: "Teams" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "outcomes-business": {
    type: "outcomes-business",
    name: "Outcomes: Business",
    description: "Animated KPI/results metric grid with count-up reveal and growth accents",
    category: "social-proof",
    icon: "trending-up",
    variants: [{ id: "default", name: "Default", description: "Reveal-on-scroll metric cards" }],
    defaultContent: {
      headline: "Measurable Results, Every Quarter",
      subheadline: "Teams that train on our platform ship faster and retain longer.",
      metrics: [
        { id: "m1", value: "98%", label: "Course Completion", description: "Learners finish what they start" },
        { id: "m2", value: "3.4x", label: "Training ROI", description: "Return within the first year" },
        { id: "m3", value: "42%", label: "Faster Onboarding", description: "New hires productive sooner" },
        { id: "m4", value: "500+", label: "Teams Onboarded", description: "Across 30+ industries" },
      ],
    } satisfies OutcomesBusinessContent,
  },

  "hero-arts": {
    type: "hero-arts",
    name: "Hero: Arts",
    description: "Warm split arts hero with floating paint blobs and a drifting image frame",
    category: "hero",
    icon: "palette",
    variants: [{ id: "default", name: "Default", description: "Creative split hero" }],
    defaultContent: {
      headline: "Turn Your Creativity Into a Craft",
      headlineAccent: "",
      description: "Learn painting, pottery, DIY and handmade skills from expert artisans.",
      primaryCta: { text: "Start Creating", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "View Gallery", href: "#section-gallery-arts-1", variant: "outline" },
      image: "https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=1400&q=80",
      imageAlt: "Artist at work",
      stats: [
        { id: "1", value: "300+", label: "Projects" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "25K+", label: "Makers" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-arts-alt": {
    type: "hero-arts-alt",
    name: "Hero: Arts (Gallery Wall)",
    description: "Immersive gallery-wall arts hero with floating framed canvases over a dark backdrop",
    category: "hero",
    icon: "brush",
    variants: [{ id: "default", name: "Default", description: "Gallery-wall immersive hero" }],
    defaultContent: {
      headline: "Make. Create. Sell.",
      headlineAccent: "",
      description: "Hands-on art and craft courses with a showcase-first gallery experience.",
      primaryCta: { text: "Browse Courses", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "Our Story", href: "#section-about-6", variant: "outline" },
      image: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=1400&q=80",
      imageAlt: "Craft studio wall",
      stats: [
        { id: "1", value: "500+", label: "Artworks" },
        { id: "2", value: "40+", label: "Mediums" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-arts-v3": {
    type: "hero-arts-v3",
    name: "Hero: Arts (Studio)",
    description: "Immersive creative-studio arts hero with drifting paint splashes over a coral wash",
    category: "hero",
    icon: "palette",
    variants: [{ id: "default", name: "Default", description: "Creative studio immersive hero" }],
    defaultContent: {
      headline: "Where Every Idea Becomes Art",
      headlineAccent: "",
      description: "Fun, beginner-friendly art and craft courses for every skill level.",
      primaryCta: { text: "Start Creating", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "Explore Studios", href: "/all-courses", variant: "outline" },
      image: "https://images.unsplash.com/photo-1499892477393-f675706cbfac?w=1400&q=80",
      imageAlt: "Creative studio",
      stats: [
        { id: "1", value: "150+", label: "Workshops" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "12K+", label: "Creators" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-kids-v3": {
    type: "hero-kids-v3",
    name: "Hero: Kids (Confetti)",
    description: "Immersive playful kids hero with falling confetti over a bright gradient",
    category: "hero",
    icon: "sparkles",
    variants: [{ id: "default", name: "Default", description: "Confetti immersive hero" }],
    defaultContent: {
      headline: "Little Learners, Big Adventures",
      headlineAccent: "",
      description: "Playful, bite-sized lessons that keep young minds curious and confident.",
      primaryCta: { text: "Start Playing", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "See Activities", href: "/all-courses", variant: "outline" },
      image: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=1400&q=80",
      imageAlt: "Happy kids learning",
      stats: [
        { id: "1", value: "6K+", label: "Kids" },
        { id: "2", value: "60+", label: "Activities" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-finance-v3": {
    type: "hero-finance-v3",
    name: "Hero: Finance (Wealth)",
    description: "Immersive wealth hero with rising growth arcs and bars over a dark-gold backdrop",
    category: "hero",
    icon: "trending-up",
    variants: [{ id: "default", name: "Default", description: "Wealth immersive hero" }],
    defaultContent: {
      headline: "Grow And Protect Your Wealth",
      headlineAccent: "",
      description: "Clear, structured investing and personal-finance courses for the long term.",
      primaryCta: { text: "Start Investing", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "View Plans", href: "/all-courses", variant: "outline" },
      image: "https://images.unsplash.com/photo-1579532537598-459ecdaf39cc?w=1400&q=80",
      imageAlt: "Wealth and investing",
      stats: [
        { id: "1", value: "30K+", label: "Investors" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "120+", label: "Strategies" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-design": {
    type: "hero-design",
    name: "Hero: Design (Spotlight)",
    description: "Creative light spotlight hero with a mesh-gradient backdrop and floating UI chips",
    category: "hero",
    icon: "pen-tool",
    variants: [{ id: "default", name: "Default", description: "Creative spotlight hero" }],
    defaultContent: {
      headline: "Design Products People Love",
      headlineAccent: "",
      description: "Master UI, UX and design systems with practical projects and mentor feedback.",
      primaryCta: { text: "Start Designing", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "View Curriculum", href: "/all-courses", variant: "outline" },
      image: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=1400&q=80",
      imageAlt: "Design studio",
      stats: [
        { id: "1", value: "12K+", label: "Designers" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "200+", label: "Projects" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-data-ai": {
    type: "hero-data-ai",
    name: "Hero: Data Science & AI",
    description: "Dark tech split hero with an animated node grid and a live data panel",
    category: "hero",
    icon: "brain-circuit",
    variants: [{ id: "default", name: "Default", description: "Data tech hero" }],
    defaultContent: {
      headline: "Turn Data Into Decisions",
      headlineAccent: "",
      description: "Learn Python, machine learning and AI by shipping real models end to end.",
      primaryCta: { text: "Start Learning", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "See Tracks", href: "/all-courses", variant: "outline" },
      image: "",
      imageAlt: "Data science and AI",
      stats: [
        { id: "1", value: "18K+", label: "Learners" },
        { id: "2", value: "4.8", label: "Rating" },
        { id: "3", value: "90+", label: "Projects" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-medical": {
    type: "hero-medical",
    name: "Hero: Medical & Nursing",
    description: "Clean, trustworthy split hero with a floating credential card and ECG pulse",
    category: "hero",
    icon: "heart-pulse",
    variants: [{ id: "default", name: "Default", description: "Medical trust hero" }],
    defaultContent: {
      headline: "Advance Your Medical Career",
      headlineAccent: "",
      description: "Structured courses for nursing, NEET PG and clinical skills, taught by practitioners.",
      primaryCta: { text: "Explore Courses", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "Talk To Us", href: "/all-courses", variant: "outline" },
      image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1400&q=80",
      imageAlt: "Healthcare professionals",
      stats: [
        { id: "1", value: "25K+", label: "Students" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "60+", label: "Courses" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-beauty": {
    type: "hero-beauty",
    name: "Hero: Beauty & Makeup",
    description: "Warm editorial hero with a large offset portrait, gold ring and drifting sparkles",
    category: "hero",
    icon: "sparkles",
    variants: [{ id: "default", name: "Default", description: "Beauty editorial hero" }],
    defaultContent: {
      headline: "Master The Art Of Beauty",
      headlineAccent: "",
      description: "Makeup, skincare and salon skills with pro techniques and certification.",
      primaryCta: { text: "Enroll Now", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "View Courses", href: "/all-courses", variant: "outline" },
      image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=1400&q=80",
      imageAlt: "Beauty and makeup artistry",
      stats: [
        { id: "1", value: "9K+", label: "Artists" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "40+", label: "Masterclasses" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-study-abroad": {
    type: "hero-study-abroad",
    name: "Hero: Study Abroad",
    description: "Immersive azure hero with a dotted world map, flight-path arcs and destination pills",
    category: "hero",
    icon: "graduation-cap",
    variants: [{ id: "default", name: "Default", description: "Global study-abroad hero" }],
    defaultContent: {
      headline: "Your Journey Abroad Starts Here",
      headlineAccent: "",
      description: "IELTS, GRE and admissions guidance to land offers from top global universities.",
      primaryCta: { text: "Book Counselling", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "Explore Programs", href: "/all-courses", variant: "outline" },
      image: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1400&q=80",
      imageAlt: "University campus",
      stats: [
        { id: "1", value: "15K+", label: "Students" },
        { id: "2", value: "500+", label: "Universities" },
        { id: "3", value: "4.9", label: "Rating" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "feature-bento": {
    type: "feature-bento",
    name: "Feature Bento Grid",
    description: "Modern bento grid of features with varied tile sizes and a staggered reveal",
    category: "features",
    icon: "layout-grid",
    variants: [{ id: "default", name: "Default", description: "Bento feature grid" }],
    defaultContent: {
      eyebrow: "Why choose us",
      headline: "A smarter way to learn",
      subheadline: "Everything you need, in one focused experience.",
      items: [
        { id: "1", icon: "rocket", title: "Learn by doing", description: "Real projects from day one, not just theory.", size: "lg" },
        { id: "2", icon: "users", title: "Expert mentors", description: "Guidance from working professionals." },
        { id: "3", icon: "line-chart", title: "Track progress", description: "Clear milestones show your growth." },
        { id: "4", icon: "shield-check", title: "Verified certificate", description: "Shareable proof of your new skills.", size: "md" },
        { id: "5", icon: "zap", title: "Learn at your pace", description: "On demand lessons that fit your life." },
        { id: "6", icon: "trophy", title: "Career support", description: "Portfolio reviews and interview prep." },
      ],
    },
  },

  "stats-band": {
    type: "stats-band",
    name: "Stats & Logos Band",
    description: "Animated social-proof band of key figures with an optional scrolling logo marquee",
    category: "social-proof",
    icon: "bar-chart",
    variants: [{ id: "default", name: "Default", description: "Stats and logo marquee" }],
    defaultContent: {
      headline: "Trusted by learners worldwide",
      subheadline: "Join a growing community achieving real outcomes.",
      stats: [
        { id: "1", value: "50K+", label: "Learners" },
        { id: "2", value: "4.9", label: "Avg Rating" },
        { id: "3", value: "120+", label: "Courses" },
        { id: "4", value: "95%", label: "Completion" },
      ],
      logos: [],
    },
  },

  "hero-marketing": {
    type: "hero-marketing",
    name: "Hero: Digital Marketing",
    description: "Dark campaign hero with a live analytics dashboard, funnel and ROI cards",
    category: "hero",
    icon: "megaphone",
    variants: [{ id: "default", name: "Default", description: "Marketing dashboard hero" }],
    defaultContent: {
      headline: "Marketing That Moves The Needle",
      headlineAccent: "",
      description: "Master SEO, paid ads, social and analytics with real campaigns and mentor feedback.",
      primaryCta: { text: "Start Learning", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "View Curriculum", href: "/all-courses", variant: "outline" },
      image: "",
      imageAlt: "Marketing analytics",
      stats: [
        { id: "1", value: "20K+", label: "Marketers" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "300+", label: "Campaigns" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-cyber": {
    type: "hero-cyber",
    name: "Hero: Cybersecurity",
    description: "Dark security console hero with a live threat monitor, shield status and feed",
    category: "hero",
    icon: "shield-check",
    variants: [{ id: "default", name: "Default", description: "Security console hero" }],
    defaultContent: {
      headline: "Become A Cyber Defender",
      headlineAccent: "",
      description: "Practical training in ethical hacking, SOC operations and cloud security.",
      primaryCta: { text: "Start Learning", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "View Labs", href: "/all-courses", variant: "outline" },
      image: "",
      imageAlt: "Security operations",
      stats: [
        { id: "1", value: "15K+", label: "Defenders" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "50+", label: "Labs" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-realestate": {
    type: "hero-realestate",
    name: "Hero: Real Estate",
    description: "Light property hero with a listing card mockup, price tag and floating map card",
    category: "hero",
    icon: "map-pin",
    variants: [{ id: "default", name: "Default", description: "Property listing hero" }],
    defaultContent: {
      headline: "Build A Career In Real Estate",
      headlineAccent: "",
      description: "Learn sales, valuation and investment with practical, market ready skills.",
      primaryCta: { text: "Get Licensed", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "View Courses", href: "/all-courses", variant: "outline" },
      image: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1400&q=80",
      imageAlt: "Modern home",
      stats: [
        { id: "1", value: "8K+", label: "Agents" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "30+", label: "Courses" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-cloud": {
    type: "hero-cloud",
    name: "Hero: Cloud & DevOps",
    description: "Dark hero with a CI/CD pipeline mockup, terminal and uptime graph",
    category: "hero",
    icon: "server",
    variants: [{ id: "default", name: "Default", description: "DevOps pipeline hero" }],
    defaultContent: {
      headline: "Deploy At Scale, Sleep At Night",
      headlineAccent: "",
      description: "Master Docker, Kubernetes and cloud infrastructure with real deployments.",
      primaryCta: { text: "Start Learning", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "View Labs", href: "/all-courses", variant: "outline" },
      image: "",
      imageAlt: "Cloud infrastructure",
      stats: [
        { id: "1", value: "12K+", label: "Engineers" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "40+", label: "Labs" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-accounting": {
    type: "hero-accounting",
    name: "Hero: Accounting & CA",
    description: "Light hero with a ledger dashboard, profit and loss chart and invoice cards",
    category: "hero",
    icon: "receipt",
    variants: [{ id: "default", name: "Default", description: "Accounting dashboard hero" }],
    defaultContent: {
      headline: "Master The Numbers Game",
      headlineAccent: "",
      description: "Practical training in accounting, GST, audit and taxation for a finance career.",
      primaryCta: { text: "Start Learning", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "View Courses", href: "/all-courses", variant: "outline" },
      image: "",
      imageAlt: "Accounting ledger",
      stats: [
        { id: "1", value: "18K+", label: "Students" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "60+", label: "Courses" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-law": {
    type: "hero-law",
    name: "Hero: Law & CLAT",
    description: "Light hero with a legal case portal, scales motif and statute checklist",
    category: "hero",
    icon: "scale",
    variants: [{ id: "default", name: "Default", description: "Legal case hero" }],
    defaultContent: {
      headline: "Argue Like An Advocate",
      headlineAccent: "",
      description: "CLAT, judiciary and drafting prep with moot courts and real case studies.",
      primaryCta: { text: "Start Preparing", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "View Courses", href: "/all-courses", variant: "outline" },
      image: "",
      imageAlt: "Law and justice",
      stats: [
        { id: "1", value: "14K+", label: "Aspirants" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "500+", label: "Cases" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-film": {
    type: "hero-film",
    name: "Hero: Film & Content",
    description: "Dark cinematic hero with a video editor mockup, timeline and REC preview",
    category: "hero",
    icon: "film",
    variants: [{ id: "default", name: "Default", description: "Video editor hero" }],
    defaultContent: {
      headline: "Create Films People Remember",
      headlineAccent: "",
      description: "Editing, cinematography, color and sound taught through real projects.",
      primaryCta: { text: "Start Creating", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "Watch Demo", href: "/all-courses", variant: "outline" },
      image: "",
      imageAlt: "Film production",
      stats: [
        { id: "1", value: "11K+", label: "Creators" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "80+", label: "Projects" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-startup": {
    type: "hero-startup",
    name: "Hero: Entrepreneurship",
    description: "Dark hero with a startup metrics dashboard, MRR growth chart and funding card",
    category: "hero",
    icon: "rocket",
    variants: [{ id: "default", name: "Default", description: "Startup metrics hero" }],
    defaultContent: {
      headline: "Turn Your Idea Into A Company",
      headlineAccent: "",
      description: "Fundraising, growth, product and sales from founders who have built and scaled.",
      primaryCta: { text: "Start Building", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "View Program", href: "/all-courses", variant: "outline" },
      image: "",
      imageAlt: "Startup metrics",
      stats: [
        { id: "1", value: "16K+", label: "Founders" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "200+", label: "Startups" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-fashion": {
    type: "hero-fashion",
    name: "Hero: Fashion Design",
    description: "Editorial fashion hero with an offset portrait, gold ring and fabric swatches",
    category: "hero",
    icon: "scissors",
    variants: [{ id: "default", name: "Default", description: "Fashion editorial hero" }],
    defaultContent: {
      headline: "Design Fashion That Turns Heads",
      headlineAccent: "",
      description: "Draping, illustration, textiles and merchandising taught by industry designers.",
      primaryCta: { text: "Start Designing", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "View Courses", href: "/all-courses", variant: "outline" },
      image: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=1400&q=80",
      imageAlt: "Fashion design",
      stats: [
        { id: "1", value: "9K+", label: "Designers" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "40+", label: "Collections" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-interior": {
    type: "hero-interior",
    name: "Hero: Interior Design",
    description: "Warm hero with a room render mockup, material swatches and a 3D render tag",
    category: "hero",
    icon: "sofa",
    variants: [{ id: "default", name: "Default", description: "Interior render hero" }],
    defaultContent: {
      headline: "Design Spaces People Love",
      headlineAccent: "",
      description: "Space planning, 3D rendering, materials and lighting through real projects.",
      primaryCta: { text: "Start Designing", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "View Courses", href: "/all-courses", variant: "outline" },
      image: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1400&q=80",
      imageAlt: "Interior design",
      stats: [
        { id: "1", value: "8K+", label: "Designers" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "80+", label: "Projects" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-yoga": {
    type: "hero-yoga",
    name: "Hero: Yoga & Meditation",
    description: "Calm hero with a breathing circle, streak dots and a soft wellness card",
    category: "hero",
    icon: "flower-2",
    variants: [{ id: "default", name: "Default", description: "Wellness breathing hero" }],
    defaultContent: {
      headline: "Teach Yoga, Change Lives",
      headlineAccent: "",
      description: "Hatha, vinyasa, pranayama and meditation with certified teacher training.",
      primaryCta: { text: "Start Practising", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "View Courses", href: "/all-courses", variant: "outline" },
      image: "",
      imageAlt: "Yoga practice",
      stats: [
        { id: "1", value: "12K+", label: "Yogis" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "30+", label: "Courses" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-dance": {
    type: "hero-dance",
    name: "Hero: Dance",
    description: "Vibrant dark hero with a dancer preview, animated beat bars and level badge",
    category: "hero",
    icon: "music-2",
    variants: [{ id: "default", name: "Default", description: "Dance beat hero" }],
    defaultContent: {
      headline: "Own Every Move",
      headlineAccent: "",
      description: "Hip hop, contemporary, ballet and Bollywood with choreographers who perform.",
      primaryCta: { text: "Start Dancing", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "Watch Demo", href: "/all-courses", variant: "outline" },
      image: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=1400&q=80",
      imageAlt: "Dance performance",
      stats: [
        { id: "1", value: "10K+", label: "Dancers" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "50+", label: "Routines" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-codekids": {
    type: "hero-codekids",
    name: "Hero: Coding for Kids",
    description: "Playful hero with a block coding canvas, a robot character and star badges",
    category: "hero",
    icon: "bot",
    variants: [{ id: "default", name: "Default", description: "Block coding hero" }],
    defaultContent: {
      headline: "Where Kids Fall In Love With Code",
      headlineAccent: "",
      description: "Scratch, Python, robotics and game design taught through playful projects.",
      primaryCta: { text: "Start The Adventure", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "View Courses", href: "/all-courses", variant: "outline" },
      image: "",
      imageAlt: "Kids coding",
      stats: [
        { id: "1", value: "20K+", label: "Young Coders" },
        { id: "2", value: "4.9", label: "Parent Rating" },
        { id: "3", value: "100+", label: "Projects" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-speaking": {
    type: "hero-speaking",
    name: "Hero: Public Speaking",
    description: "Hero with a live keynote slide mockup and a confidence meter",
    category: "hero",
    icon: "mic",
    variants: [{ id: "default", name: "Default", description: "Keynote stage hero" }],
    defaultContent: {
      headline: "Speak So People Listen",
      headlineAccent: "",
      description: "Storytelling, debate and stage presence with real speaking practice.",
      primaryCta: { text: "Start Speaking", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "View Courses", href: "/all-courses", variant: "outline" },
      image: "",
      imageAlt: "Public speaking",
      stats: [
        { id: "1", value: "14K+", label: "Speakers" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "50+", label: "Workshops" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-hospitality": {
    type: "hero-hospitality",
    name: "Hero: Hospitality",
    description: "Warm hero with a fine dining card, rating and reservation strip",
    category: "hero",
    icon: "utensils-crossed",
    variants: [{ id: "default", name: "Default", description: "Fine dining hero" }],
    defaultContent: {
      headline: "Serve World Class Experiences",
      headlineAccent: "",
      description: "Culinary arts, baking and hotel operations taught in real kitchens.",
      primaryCta: { text: "Start Cooking", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "View Courses", href: "/all-courses", variant: "outline" },
      image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1400&q=80",
      imageAlt: "Fine dining",
      stats: [
        { id: "1", value: "12K+", label: "Chefs" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "60+", label: "Courses" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-spiritual": {
    type: "hero-spiritual",
    name: "Hero: Spirituality",
    description: "Mystical dark hero with a rotating mandala, wisdom card and moon phases",
    category: "hero",
    icon: "sparkles",
    variants: [{ id: "default", name: "Default", description: "Mandala meditation hero" }],
    defaultContent: {
      headline: "Walk The Path Within",
      headlineAccent: "",
      description: "Vedic wisdom, meditation and Sanskrit taught by experienced masters.",
      primaryCta: { text: "Begin Your Journey", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "View Courses", href: "/all-courses", variant: "outline" },
      image: "",
      imageAlt: "Meditation and spirituality",
      stats: [
        { id: "1", value: "18K+", label: "Seekers" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "40+", label: "Courses" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-kids": {
    type: "hero-kids",
    name: "Hero: Kids",
    description: "Playful split kids hero with rounded shapes, polka dots and a bouncing image frame",
    category: "hero",
    icon: "sparkles",
    variants: [{ id: "default", name: "Default", description: "Playful split hero" }],
    defaultContent: {
      headline: "Learning Made Fun for Every Child",
      headlineAccent: "",
      description: "Interactive courses, live classes and activities kids genuinely love.",
      primaryCta: { text: "Start Learning", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "See How", href: "#section-path-kids-1", variant: "outline" },
      image: "https://images.unsplash.com/photo-1587616211892-f743fcca64f9?w=1400&q=80",
      imageAlt: "Happy child learning",
      stats: [
        { id: "1", value: "10K+", label: "Kids" },
        { id: "2", value: "4.9", label: "Parent Rating" },
        { id: "3", value: "200+", label: "Activities" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-kids-alt": {
    type: "hero-kids-alt",
    name: "Hero: Kids (Balloons)",
    description: "Immersive kids hero with floating balloons over a bright, friendly gradient",
    category: "hero",
    icon: "star",
    variants: [{ id: "default", name: "Default", description: "Balloons immersive hero" }],
    defaultContent: {
      headline: "Where Little Learners Grow",
      headlineAccent: "",
      description: "Playful, bite-sized lessons that make every young mind light up.",
      primaryCta: { text: "Join the Fun", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "For Parents", href: "#section-about-3", variant: "outline" },
      image: "https://images.unsplash.com/photo-1526634332515-d56c5fd16991?w=1400&q=80",
      imageAlt: "Children playing and learning",
      stats: [
        { id: "1", value: "8K+", label: "Little Learners" },
        { id: "2", value: "50+", label: "Fun Courses" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-finance": {
    type: "hero-finance",
    name: "Hero: Finance",
    description: "Split finance hero with an animated line-chart curve and a market image frame",
    category: "hero",
    icon: "trending-up",
    variants: [{ id: "default", name: "Default", description: "Chart split hero" }],
    defaultContent: {
      headline: "Master Money, Markets and Wealth",
      headlineAccent: "",
      description: "Practical finance, trading and investing courses from proven experts.",
      primaryCta: { text: "Start Investing", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "View Markets", href: "#section-markets-finance-1", variant: "outline" },
      image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1400&q=80",
      imageAlt: "Financial markets",
      stats: [
        { id: "1", value: "35K+", label: "Investors" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "120+", label: "Strategies" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-finance-alt": {
    type: "hero-finance-alt",
    name: "Hero: Finance (Candles)",
    description: "Immersive trading hero with an animated candlestick backdrop and centered copy",
    category: "hero",
    icon: "line-chart",
    variants: [{ id: "default", name: "Default", description: "Candlestick immersive hero" }],
    defaultContent: {
      headline: "Trade With Confidence",
      headlineAccent: "",
      description: "Live market sessions, strategies and analytics for serious traders.",
      primaryCta: { text: "Join a Session", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "See Results", href: "#section-markets-finance-1", variant: "outline" },
      image: "https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=1400&q=80",
      imageAlt: "Trading charts",
      stats: [
        { id: "1", value: "12K+", label: "Traders" },
        { id: "2", value: "24/5", label: "Live Desk" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-language": {
    type: "hero-language",
    name: "Hero: Language",
    description: "Split language hero with floating phrase bubbles and a conversational image frame",
    category: "hero",
    icon: "languages",
    variants: [{ id: "default", name: "Default", description: "Bubbles split hero" }],
    defaultContent: {
      headline: "Speak a New Language With Confidence",
      headlineAccent: "",
      description: "Structured lessons, live practice and immersion, all in one place.",
      primaryCta: { text: "Start Speaking", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "Try a Lesson", href: "#section-phrases-language-1", variant: "outline" },
      image: "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=1400&q=80",
      imageAlt: "People in conversation",
      stats: [
        { id: "1", value: "30+", label: "Languages" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "60K+", label: "Learners" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-language-alt": {
    type: "hero-language-alt",
    name: "Hero: Language (Word Cloud)",
    description: "Immersive language hero with floating greetings in many languages over a dark scene",
    category: "hero",
    icon: "message-circle",
    variants: [{ id: "default", name: "Default", description: "Word-cloud immersive hero" }],
    defaultContent: {
      headline: "Go From Beginner to Fluent",
      headlineAccent: "",
      description: "Vibrant, conversation-first language courses that actually stick.",
      primaryCta: { text: "Get Fluent", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "How It Works", href: "#section-phrases-language-1", variant: "outline" },
      image: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1400&q=80",
      imageAlt: "Language learners",
      stats: [
        { id: "1", value: "1M+", label: "Phrases Learned" },
        { id: "2", value: "15", label: "Min a Day" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-skills": {
    type: "hero-skills",
    name: "Hero: Skills",
    description: "Split skills hero with an orbiting icon ring around a spotlight image frame",
    category: "hero",
    icon: "rocket",
    variants: [{ id: "default", name: "Default", description: "Orbit split hero" }],
    defaultContent: {
      headline: "Learn the Skills That Matter",
      headlineAccent: "",
      description: "Practical, in-demand skills taught by industry pros, built for real outcomes.",
      primaryCta: { text: "Explore Skills", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "Browse Tracks", href: "#section-tracks-skills-1", variant: "outline" },
      image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1400&q=80",
      imageAlt: "Team learning together",
      stats: [
        { id: "1", value: "150+", label: "Skills" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "80K+", label: "Graduates" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-quant": {
    type: "hero-quant",
    name: "Hero: Quant Finance",
    description:
      "Premium dark, centered hero with a serif-italic gradient accent, a glowing animated 3D wireframe surface, a math watermark and an icon stats bar",
    category: "hero",
    icon: "trending-up",
    variants: [{ id: "default", name: "Default", description: "Dark 3D mesh hero" }],
    defaultContent: {
      eyebrow: "Quant Finance. Taught Practically.",
      headline: "Learn Quant Finance.",
      headlineAccent: "Think Like a Quant.",
      description:
        "Master derivatives, risk, fixed income, algorithmic trading and Python through hands-on, industry-focused projects.",
      primaryCta: { text: "Explore Courses", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "Watch Free Lesson", href: "#section-all-courses-listing-2", variant: "outline" },
      trust: "Trusted by 5,000+ learners worldwide",
      stats: [
        { id: "1", value: "10+", label: "Courses" },
        { id: "2", value: "50K+", label: "Community" },
        { id: "3", value: "20+", label: "Projects" },
        { id: "4", value: "95%", label: "Completion" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-quant-institute": {
    type: "hero-quant-institute",
    name: "Hero: Quant Institute (Light)",
    description:
      "Light editorial split hero with an italic serif headline, bold-phrase copy, dual CTAs, an icon stats row, a bottom-right anchored photo and a trusted-by institution wordmark bar",
    category: "hero",
    icon: "graduation-cap",
    variants: [{ id: "default", name: "Default", description: "Light serif split hero" }],
    defaultContent: {
      eyebrow: "Learn. Build. Quantify Your Future.",
      headline: "Master",
      headlineAccent: "Quantitative Finance.",
      headlineSuffix: "Think like a Quant.",
      description:
        "Industry-focused training in **Quant Finance, Risk, and Modeling.**\nLive sessions, **real-world projects**, and career support\nto help you break into **top quantitative roles.**",
      primaryCta: { text: "Explore Programs", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "Book a Free Call", href: "/contact", variant: "outline" },
      stats: [
        { id: "1", value: "15+", label: "Bootcamps\nDelivered" },
        { id: "2", value: "2000+", label: "Students\nTrained" },
        { id: "3", value: "90%+", label: "Career Success\nRate" },
      ],
      trust: "Trusted by students from",
      institutions: [
        {
          id: "1",
          name: "Northpeak Capital",
          logo: "/templates/quant-institute/logos/northpeak-capital.svg",
        },
        {
          id: "2",
          name: "Bluestone Bank",
          logo: "/templates/quant-institute/logos/bluestone-bank.svg",
        },
        {
          id: "3",
          name: "Meridian Partners",
          logo: "/templates/quant-institute/logos/meridian-partners.svg",
        },
        {
          id: "4",
          name: "Harborline Securities",
          logo: "/templates/quant-institute/logos/harborline-securities.svg",
        },
        {
          id: "5",
          name: "Crestview Finance",
          logo: "/templates/quant-institute/logos/crestview-finance.svg",
        },
        {
          id: "6",
          name: "Summit Ridge Group",
          logo: "/templates/quant-institute/logos/summit-ridge-group.svg",
        },
      ],
      image:
        "/templates/quant-institute/hero.webp",
      imageAlt: "Professional at a laptop planning her quantitative finance career",
    } satisfies HeroPhotographyContent,
  },

  "hero-cooking-alt": {
    type: "hero-cooking-alt",
    name: "Hero: Cooking (Immersive)",
    description: "Immersive full-bleed cooking hero with rising steam wisps and centered copy",
    category: "hero",
    icon: "chef-hat",
    variants: [{ id: "default", name: "Default", description: "Steam immersive hero" }],
    defaultContent: {
      headline: "Master the Art of Cooking",
      headlineAccent: "",
      description: "Hands-on culinary courses, live classes and recipe libraries in one place.",
      primaryCta: { text: "Start Cooking", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "See Recipes", href: "#section-all-courses-listing-2", variant: "outline" },
      image: "https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=1400&q=80",
      imageAlt: "Chef plating a dish",
      stats: [
        { id: "1", value: "500+", label: "Recipes" },
        { id: "2", value: "30K+", label: "Home Chefs" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-fitness-alt": {
    type: "hero-fitness-alt",
    name: "Hero: Fitness (Pulse)",
    description: "Split fitness hero variant with an animated heartbeat pulse line and image frame",
    category: "hero",
    icon: "activity",
    variants: [{ id: "default", name: "Default", description: "Pulse split hero" }],
    defaultContent: {
      headline: "Your Personal Training, Online",
      headlineAccent: "",
      description: "Structured programs, live sessions and expert coaching, anywhere.",
      primaryCta: { text: "Start Training", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "Meet Coaches", href: "#section-about-5", variant: "outline" },
      image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1400&q=80",
      imageAlt: "Personal training session",
      stats: [
        { id: "1", value: "50K+", label: "Members" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "120+", label: "Programs" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-music-alt": {
    type: "hero-music-alt",
    name: "Hero: Music (Vinyl)",
    description: "Split music hero variant with a spinning vinyl record and image frame",
    category: "hero",
    icon: "disc-3",
    variants: [{ id: "default", name: "Default", description: "Vinyl split hero" }],
    defaultContent: {
      headline: "Make Music That Moves People",
      headlineAccent: "",
      description: "Production, theory and performance courses in one vibrant studio.",
      primaryCta: { text: "Start Learning", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "Listen", href: "#section-genres-music-1", variant: "outline" },
      image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1400&q=80",
      imageAlt: "Music studio session",
      stats: [
        { id: "1", value: "20K+", label: "Students" },
        { id: "2", value: "4.9", label: "Rating" },
        { id: "3", value: "80+", label: "Courses" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "hero-business-alt": {
    type: "hero-business-alt",
    name: "Hero: Business (Global)",
    description: "Immersive corporate hero with an animated dotted world map and centered copy",
    category: "hero",
    icon: "briefcase",
    variants: [{ id: "default", name: "Default", description: "Dotted-map immersive hero" }],
    defaultContent: {
      headline: "Learning That Drives Performance",
      headlineAccent: "",
      description: "Role-based paths, live cohorts and measurable outcomes for your workforce.",
      primaryCta: { text: "Book a Demo", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "Explore Solutions", href: "#section-outcomes-business-1", variant: "outline" },
      image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1400&q=80",
      imageAlt: "Corporate team",
      stats: [
        { id: "1", value: "500+", label: "Teams" },
        { id: "2", value: "30+", label: "Countries" },
      ],
    } satisfies HeroPhotographyContent,
  },

  "gallery-arts": {
    type: "gallery-arts",
    name: "Gallery: Arts",
    description: "Masonry-style 3D showcase of student artwork with medium tags",
    category: "content",
    icon: "palette",
    variants: [{ id: "default", name: "Default", description: "Masonry gallery grid" }],
    defaultContent: {
      headline: "From Our Community of Makers",
      subheadline: "Real work created by students across every medium and skill level.",
      items: [
        { id: "a1", title: "Ceramic Vase", medium: "Pottery", image: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&q=80" },
        { id: "a2", title: "Abstract Canvas", medium: "Acrylic", image: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&q=80" },
        { id: "a3", title: "Hand Lettering", medium: "Calligraphy", image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&q=80" },
        { id: "a4", title: "Woven Textile", medium: "Fiber Art", image: "https://images.unsplash.com/photo-1528834342297-fdefb9a5a92b?w=800&q=80" },
        { id: "a5", title: "Watercolor Study", medium: "Watercolor", image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&q=80" },
        { id: "a6", title: "Clay Sculpture", medium: "Sculpture", image: "https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?w=800&q=80" },
      ],
    } satisfies ArtsGalleryContent,
  },

  "path-kids": {
    type: "path-kids",
    name: "Path: Kids",
    description: "Playful step-by-step learning path with bouncing emoji milestones",
    category: "features",
    icon: "sparkles",
    variants: [{ id: "default", name: "Default", description: "Emoji step path" }],
    defaultContent: {
      headline: "A Learning Journey Kids Love",
      subheadline: "Four simple steps from first lesson to proud achievement.",
      steps: [
        { id: "s1", emoji: "🎯", title: "Pick a Course", description: "Choose from fun, colorful subjects." },
        { id: "s2", emoji: "🎨", title: "Learn & Play", description: "Interactive lessons and activities." },
        { id: "s3", emoji: "⭐", title: "Earn Badges", description: "Celebrate every milestone." },
        { id: "s4", emoji: "🏆", title: "Show Off", description: "Share projects with family." },
      ],
    } satisfies KidsPathContent,
  },

  "markets-finance": {
    type: "markets-finance",
    name: "Markets: Finance",
    description: "Animated live-market ticker board with sparklines and summary stats",
    category: "social-proof",
    icon: "line-chart",
    variants: [{ id: "default", name: "Default", description: "Ticker board + stats" }],
    defaultContent: {
      headline: "Learn on Real Markets",
      subheadline: "Track the assets you'll study, with live-style data and hands-on analysis.",
      tickers: [
        { id: "t1", symbol: "AAPL", name: "Apple Inc.", price: "224.31", change: "+1.24%", up: true },
        { id: "t2", symbol: "BTC", name: "Bitcoin", price: "63,120", change: "+3.80%", up: true },
        { id: "t3", symbol: "TSLA", name: "Tesla", price: "248.50", change: "-0.92%", up: false },
        { id: "t4", symbol: "NIFTY", name: "Nifty 50", price: "24,010", change: "+0.45%", up: true },
        { id: "t5", symbol: "GOLD", name: "Gold Spot", price: "2,410", change: "-0.31%", up: false },
      ],
      stats: [
        { id: "m1", value: "35K+", label: "Active Traders" },
        { id: "m2", value: "120+", label: "Strategies" },
        { id: "m3", value: "4.9", label: "Avg Rating" },
        { id: "m4", value: "24/5", label: "Live Desk" },
      ],
    } satisfies FinanceMarketsContent,
  },

  "phrases-language": {
    type: "phrases-language",
    name: "Phrases: Language",
    description: "Interactive flip cards that reveal translations of everyday phrases",
    category: "features",
    icon: "message-circle",
    variants: [{ id: "default", name: "Default", description: "Flip phrase cards" }],
    defaultContent: {
      headline: "Say It Like a Local",
      subheadline: "Hover any card to reveal the translation. Practice the phrases you'll actually use.",
      items: [
        { id: "p1", phrase: "¡Hola!", translation: "Hello!", language: "Spanish" },
        { id: "p2", phrase: "Merci beaucoup", translation: "Thank you very much", language: "French" },
        { id: "p3", phrase: "こんにちは", translation: "Good afternoon", language: "Japanese" },
        { id: "p4", phrase: "Wie geht's?", translation: "How are you?", language: "German" },
        { id: "p5", phrase: "Ciao!", translation: "Bye!", language: "Italian" },
        { id: "p6", phrase: "감사합니다", translation: "Thank you", language: "Korean" },
      ],
    } satisfies LanguagePhrasesContent,
  },

  "tracks-skills": {
    type: "tracks-skills",
    name: "Tracks: Skills",
    description: "3D tilt grid of skill tracks with level and lesson counts",
    category: "content",
    icon: "rocket",
    variants: [{ id: "default", name: "Default", description: "Skill track cards" }],
    defaultContent: {
      headline: "Career-Building Skill Tracks",
      subheadline: "Structured, outcome-focused paths in the skills employers want most.",
      items: [
        { id: "k1", title: "Data Analytics", level: "Beginner", lessons: "42 lessons", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80" },
        { id: "k2", title: "Digital Marketing", level: "Intermediate", lessons: "38 lessons", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80" },
        { id: "k3", title: "UI/UX Design", level: "Beginner", lessons: "45 lessons", image: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&q=80" },
        { id: "k4", title: "Public Speaking", level: "All Levels", lessons: "24 lessons", image: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800&q=80" },
        { id: "k5", title: "Project Management", level: "Intermediate", lessons: "36 lessons", image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80" },
        { id: "k6", title: "Web Development", level: "Beginner", lessons: "60 lessons", image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&q=80" },
      ],
    } satisfies SkillsTracksContent,
  },

  "features-fitness": {
    type: "features-fitness",
    name: "Features: Fitness",
    description: "Animated feature cards with a fitness motif",
    category: "features",
    icon: "dumbbell",
    variants: [{ id: "default", name: "Default", description: "Animated feature grid" }],
    defaultContent: {
      headline: "Built to Get You Results",
      subheadline: "Structured programs, expert coaching and a community that keeps you going.",
      items: [
        { id: "f1", icon: "dumbbell", title: "Personalized Programs", description: "Plans that adapt to your goals and level." },
        { id: "f2", icon: "timer", title: "Train Anytime", description: "On-demand sessions plus live classes." },
        { id: "f3", icon: "flame", title: "Real Coaching", description: "Feedback and cues from certified trainers." },
        { id: "f4", icon: "heart", title: "Nutrition Guidance", description: "Fuel your training the right way." },
        { id: "f5", icon: "users", title: "Community Support", description: "Stay accountable with others." },
        { id: "f6", icon: "trophy", title: "Track Progress", description: "See your gains week over week." },
      ],
    } satisfies NicheFeaturesContent,
  },
  "testimonials-fitness": {
    type: "testimonials-fitness",
    name: "Testimonials: Fitness",
    description: "Testimonial cards with a fitness motif",
    category: "social-proof",
    icon: "dumbbell",
    variants: [{ id: "default", name: "Default", description: "Testimonial card grid" }],
    defaultContent: {
      headline: "Results That Speak for Themselves",
      subheadline: "Members who showed up and transformed.",
      items: [
        { id: "t1", name: "Jordan Miles", role: "Lost 18kg", quote: "The programs actually fit my schedule. Down 18kg and stronger than ever.", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80", rating: 5 },
        { id: "t2", name: "Sana Verma", role: "Marathon Finisher", quote: "Went from couch to my first marathon with the training plans here.", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80", rating: 5 },
        { id: "t3", name: "Diego Torres", role: "Powerlifter", quote: "The coaching cues fixed my form and my lifts shot up.", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80", rating: 5 },
      ],
    } satisfies NicheTestimonialsContent,
  },
  "cta-fitness": {
    type: "cta-fitness",
    name: "CTA: Fitness",
    description: "Gradient CTA with a fitness motif",
    category: "conversion",
    icon: "dumbbell",
    variants: [{ id: "default", name: "Default", description: "Gradient CTA banner" }],
    defaultContent: {
      headline: "Your Strongest Self Starts Now",
      subheadline: "Join thousands training smarter every single day.",
      primaryCta: { text: "Start Training", href: "/all-courses" },
      secondaryCta: { text: "See Programs", href: "#section-programs-fitness-1" },
    } satisfies NicheCtaContent,
  },

  "features-music": {
    type: "features-music",
    name: "Features: Music",
    description: "Animated feature cards with a music motif",
    category: "features",
    icon: "music",
    variants: [{ id: "default", name: "Default", description: "Animated feature grid" }],
    defaultContent: {
      headline: "Everything You Need to Make Music",
      subheadline: "From first chord to finished track, taught by working musicians.",
      items: [
        { id: "f1", icon: "music", title: "Any Instrument", description: "Guitar, piano, drums, vocals and more." },
        { id: "f2", icon: "mic", title: "Real Production", description: "Record, mix and master your own sound." },
        { id: "f3", icon: "headphones", title: "Ear Training", description: "Develop the skills that matter most." },
        { id: "f4", icon: "disc", title: "Theory Made Simple", description: "Understand what you're playing and why." },
        { id: "f5", icon: "users", title: "Play Together", description: "Community jams and honest feedback." },
        { id: "f6", icon: "award", title: "Perform & Release", description: "Take your music to the world." },
      ],
    } satisfies NicheFeaturesContent,
  },
  "testimonials-music": {
    type: "testimonials-music",
    name: "Testimonials: Music",
    description: "Testimonial cards with a music motif",
    category: "social-proof",
    icon: "music",
    variants: [{ id: "default", name: "Default", description: "Testimonial card grid" }],
    defaultContent: {
      headline: "From Our Musicians",
      subheadline: "Real students who found their sound with us.",
      items: [
        { id: "t1", name: "Nina Park", role: "Singer-Songwriter", quote: "I wrote and produced my first EP after these courses. Absolutely life-changing.", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80", rating: 5 },
        { id: "t2", name: "Leo Fernandes", role: "Producer", quote: "The production modules are pro-level. My mixes finally sound clean and full.", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80", rating: 5 },
        { id: "t3", name: "Maya Roy", role: "Guitarist", quote: "Went from bedroom chords to playing live in six months.", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80", rating: 5 },
      ],
    } satisfies NicheTestimonialsContent,
  },
  "cta-music": {
    type: "cta-music",
    name: "CTA: Music",
    description: "Gradient CTA with a music motif",
    category: "conversion",
    icon: "music",
    variants: [{ id: "default", name: "Default", description: "Gradient CTA banner" }],
    defaultContent: {
      headline: "Ready to Find Your Sound?",
      subheadline: "Start learning from working musicians and producers today.",
      primaryCta: { text: "Start Learning", href: "/all-courses" },
      secondaryCta: { text: "Explore Genres", href: "#section-genres-music-1" },
    } satisfies NicheCtaContent,
  },

  "features-business": {
    type: "features-business",
    name: "Features: Business",
    description: "Animated feature cards with a corporate motif",
    category: "features",
    icon: "briefcase",
    variants: [{ id: "default", name: "Default", description: "Animated feature grid" }],
    defaultContent: {
      headline: "Learning That Moves the Business",
      subheadline: "Role-based paths, analytics and outcomes leaders can measure.",
      items: [
        { id: "f1", icon: "briefcase", title: "Role-Based Paths", description: "The right skills for every role and team." },
        { id: "f2", icon: "chart", title: "Analytics & Reporting", description: "See engagement and completion at a glance." },
        { id: "f3", icon: "target", title: "Measurable Outcomes", description: "Tie learning to real business results." },
        { id: "f4", icon: "shield", title: "Enterprise-Ready", description: "SSO, security and admin controls." },
        { id: "f5", icon: "users", title: "Team Cohorts", description: "Learn together with live cohorts." },
        { id: "f6", icon: "trending", title: "Continuous Upskilling", description: "Keep teams ahead of what's next." },
      ],
    } satisfies NicheFeaturesContent,
  },
  "testimonials-business": {
    type: "testimonials-business",
    name: "Testimonials: Business",
    description: "Testimonial cards with a corporate motif",
    category: "social-proof",
    icon: "briefcase",
    variants: [{ id: "default", name: "Default", description: "Testimonial card grid" }],
    defaultContent: {
      headline: "Trusted by Teams That Ship",
      subheadline: "Leaders who made learning measurable.",
      items: [
        { id: "t1", name: "Rahul Nair", role: "L&D Director", quote: "Our completion rates doubled and onboarding is weeks faster.", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80", rating: 5 },
        { id: "t2", name: "Emily Carter", role: "VP, People", quote: "The analytics finally show us real ROI on training spend.", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80", rating: 5 },
        { id: "t3", name: "Tomás Silva", role: "Engineering Lead", quote: "Role-based paths meant every engineer got exactly what they needed.", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80", rating: 5 },
      ],
    } satisfies NicheTestimonialsContent,
  },
  "cta-business": {
    type: "cta-business",
    name: "CTA: Business",
    description: "Gradient CTA with a corporate motif",
    category: "conversion",
    icon: "briefcase",
    variants: [{ id: "default", name: "Default", description: "Gradient CTA banner" }],
    defaultContent: {
      headline: "Upskill Your Whole Organization",
      subheadline: "Give every team the skills to perform and grow.",
      primaryCta: { text: "Book a Demo", href: "/all-courses" },
      secondaryCta: { text: "Explore Solutions", href: "#section-outcomes-business-1" },
    } satisfies NicheCtaContent,
  },

  "features-arts": {
    type: "features-arts",
    name: "Features: Arts",
    description: "Animated feature cards with an arts motif",
    category: "features",
    icon: "palette",
    variants: [{ id: "default", name: "Default", description: "Animated feature grid" }],
    defaultContent: {
      headline: "Where Makers Come to Grow",
      subheadline: "Guided projects, real technique and a community that celebrates your work.",
      items: [
        { id: "f1", icon: "palette", title: "Every Medium", description: "Painting, pottery, illustration, fiber and more." },
        { id: "f2", icon: "brush", title: "Guided Projects", description: "Finish real pieces, not just exercises." },
        { id: "f3", icon: "scissors", title: "Hands-On Craft", description: "Learn the techniques pros use daily." },
        { id: "f4", icon: "sparkles", title: "Find Your Style", description: "Explore and develop your own voice." },
        { id: "f5", icon: "users", title: "Maker Community", description: "Share work and get warm feedback." },
        { id: "f6", icon: "award", title: "Showcase & Sell", description: "Turn your craft into a side income." },
      ],
    } satisfies NicheFeaturesContent,
  },
  "testimonials-arts": {
    type: "testimonials-arts",
    name: "Testimonials: Arts",
    description: "Testimonial cards with an arts motif",
    category: "social-proof",
    icon: "palette",
    variants: [{ id: "default", name: "Default", description: "Testimonial card grid" }],
    defaultContent: {
      headline: "From Our Community of Makers",
      subheadline: "Students who found their creative confidence.",
      items: [
        { id: "t1", name: "Hana Ito", role: "Ceramicist", quote: "I sold my first collection of bowls after the pottery track. Still can't believe it.", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80", rating: 5 },
        { id: "t2", name: "Owen Brooks", role: "Illustrator", quote: "The projects gave me a real portfolio, not just doodles.", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80", rating: 5 },
        { id: "t3", name: "Lucia Romano", role: "Fiber Artist", quote: "Found my style and a community that actually gets it.", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80", rating: 5 },
      ],
    } satisfies NicheTestimonialsContent,
  },
  "cta-arts": {
    type: "cta-arts",
    name: "CTA: Arts",
    description: "Gradient CTA with an arts motif",
    category: "conversion",
    icon: "palette",
    variants: [{ id: "default", name: "Default", description: "Gradient CTA banner" }],
    defaultContent: {
      headline: "Start Making Something Beautiful",
      subheadline: "Join a community of makers creating every day.",
      primaryCta: { text: "Start Creating", href: "/all-courses" },
      secondaryCta: { text: "View Gallery", href: "#section-gallery-arts-1" },
    } satisfies NicheCtaContent,
  },

  "features-kids": {
    type: "features-kids",
    name: "Features: Kids",
    description: "Animated feature cards with a playful kids motif",
    category: "features",
    icon: "sparkles",
    variants: [{ id: "default", name: "Default", description: "Animated feature grid" }],
    defaultContent: {
      headline: "Learning Kids Actually Look Forward To",
      subheadline: "Playful, safe and effective lessons that make progress feel like play.",
      items: [
        { id: "f1", icon: "smile", title: "Fun First", description: "Games and stories that keep kids engaged." },
        { id: "f2", icon: "star", title: "Bite-Sized Lessons", description: "Short lessons that fit little attention spans." },
        { id: "f3", icon: "sparkles", title: "Interactive Play", description: "Learn by doing, not just watching." },
        { id: "f4", icon: "heart", title: "Safe & Friendly", description: "A kind, ad-free space to learn." },
        { id: "f5", icon: "users", title: "Learn Together", description: "Group activities and friendly challenges." },
        { id: "f6", icon: "shield", title: "Parent Dashboard", description: "Track progress and celebrate wins." },
      ],
    } satisfies NicheFeaturesContent,
  },
  "testimonials-kids": {
    type: "testimonials-kids",
    name: "Testimonials: Kids",
    description: "Testimonial cards with a kids motif",
    category: "social-proof",
    icon: "sparkles",
    variants: [{ id: "default", name: "Default", description: "Testimonial card grid" }],
    defaultContent: {
      headline: "Happy Parents, Happy Kids",
      subheadline: "Families who love learning with us.",
      items: [
        { id: "t1", name: "Meera Joshi", role: "Parent", quote: "My daughter asks to do her lessons. I never thought I'd hear that.", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80", rating: 5 },
        { id: "t2", name: "David Kim", role: "Parent", quote: "The bite-sized lessons are perfect, and I can see his progress every week.", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80", rating: 5 },
        { id: "t3", name: "Sara Ahmed", role: "Parent", quote: "Safe, friendly and genuinely fun. Exactly what we were looking for.", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80", rating: 5 },
      ],
    } satisfies NicheTestimonialsContent,
  },
  "cta-kids": {
    type: "cta-kids",
    name: "CTA: Kids",
    description: "Gradient CTA with a kids motif",
    category: "conversion",
    icon: "sparkles",
    variants: [{ id: "default", name: "Default", description: "Gradient CTA banner" }],
    defaultContent: {
      headline: "Give Your Child a Head Start",
      subheadline: "Fun, safe learning your kids will actually enjoy.",
      primaryCta: { text: "Start Learning", href: "/all-courses" },
      secondaryCta: { text: "See How It Works", href: "#section-path-kids-1" },
    } satisfies NicheCtaContent,
  },

  "features-finance": {
    type: "features-finance",
    name: "Features: Finance",
    description: "Animated feature cards with a finance motif",
    category: "features",
    icon: "trending-up",
    variants: [{ id: "default", name: "Default", description: "Animated feature grid" }],
    defaultContent: {
      headline: "Learn to Grow and Protect Your Money",
      subheadline: "Practical, no-hype courses from investors and traders who do this daily.",
      items: [
        { id: "f1", icon: "trending", title: "Market Fundamentals", description: "Understand how markets really work." },
        { id: "f2", icon: "line-chart", title: "Live Analysis", description: "Learn to read charts and trends." },
        { id: "f3", icon: "dollar", title: "Real Strategies", description: "Actionable, risk-aware approaches." },
        { id: "f4", icon: "piggy", title: "Personal Finance", description: "Budget, save and invest with confidence." },
        { id: "f5", icon: "shield", title: "Risk Management", description: "Protect your capital first." },
        { id: "f6", icon: "chart", title: "Portfolio Building", description: "Construct a portfolio that lasts." },
      ],
    } satisfies NicheFeaturesContent,
  },
  "testimonials-finance": {
    type: "testimonials-finance",
    name: "Testimonials: Finance",
    description: "Testimonial cards with a finance motif",
    category: "social-proof",
    icon: "trending-up",
    variants: [{ id: "default", name: "Default", description: "Testimonial card grid" }],
    defaultContent: {
      headline: "Trusted by Investors and Traders",
      subheadline: "Students who took control of their finances.",
      items: [
        { id: "t1", name: "Arjun Mehta", role: "Retail Investor", quote: "Finally understand what I'm buying and why. My portfolio is up and calmer.", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80", rating: 5 },
        { id: "t2", name: "Grace Lin", role: "Day Trader", quote: "The live analysis sessions changed how I read the market completely.", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80", rating: 5 },
        { id: "t3", name: "Peter Novak", role: "Long-Term Investor", quote: "No hype, just solid strategy and risk management. Exactly what I needed.", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80", rating: 5 },
      ],
    } satisfies NicheTestimonialsContent,
  },
  "cta-finance": {
    type: "cta-finance",
    name: "CTA: Finance",
    description: "Gradient CTA with a finance motif",
    category: "conversion",
    icon: "trending-up",
    variants: [{ id: "default", name: "Default", description: "Gradient CTA banner" }],
    defaultContent: {
      headline: "Take Control of Your Financial Future",
      subheadline: "Learn the strategies that build lasting wealth.",
      primaryCta: { text: "Start Learning", href: "/all-courses" },
      secondaryCta: { text: "View Markets", href: "#section-markets-finance-1" },
    } satisfies NicheCtaContent,
  },

  "features-language": {
    type: "features-language",
    name: "Features: Language",
    description: "Animated feature cards with a language motif",
    category: "features",
    icon: "languages",
    variants: [{ id: "default", name: "Default", description: "Animated feature grid" }],
    defaultContent: {
      headline: "The Fastest Way to Actually Speak",
      subheadline: "Conversation-first lessons that get you talking from day one.",
      items: [
        { id: "f1", icon: "languages", title: "30+ Languages", description: "Learn the language you've always wanted." },
        { id: "f2", icon: "message", title: "Real Conversations", description: "Practice speaking, not just memorizing." },
        { id: "f3", icon: "globe", title: "Cultural Immersion", description: "Understand context, not just words." },
        { id: "f4", icon: "volume", title: "Native Audio", description: "Train your ear with native speakers." },
        { id: "f5", icon: "users", title: "Practice Partners", description: "Speak with a global community." },
        { id: "f6", icon: "award", title: "Track Fluency", description: "See your progress toward fluency." },
      ],
    } satisfies NicheFeaturesContent,
  },
  "testimonials-language": {
    type: "testimonials-language",
    name: "Testimonials: Language",
    description: "Testimonial cards with a language motif",
    category: "social-proof",
    icon: "languages",
    variants: [{ id: "default", name: "Default", description: "Testimonial card grid" }],
    defaultContent: {
      headline: "From Our Speakers",
      subheadline: "Learners who went from hello to fluent.",
      items: [
        { id: "t1", name: "Camila Reyes", role: "Now Fluent in French", quote: "I was speaking in full sentences within weeks. The conversation focus really works.", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80", rating: 5 },
        { id: "t2", name: "Kenji Watanabe", role: "Learning Spanish", quote: "The native audio trained my ear better than years of textbooks.", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80", rating: 5 },
        { id: "t3", name: "Fatima Noor", role: "Business English", quote: "I finally feel confident presenting to international clients.", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80", rating: 5 },
      ],
    } satisfies NicheTestimonialsContent,
  },
  "cta-language": {
    type: "cta-language",
    name: "CTA: Language",
    description: "Gradient CTA with a language motif",
    category: "conversion",
    icon: "languages",
    variants: [{ id: "default", name: "Default", description: "Gradient CTA banner" }],
    defaultContent: {
      headline: "Start Speaking From Day One",
      subheadline: "Join millions learning to speak with confidence.",
      primaryCta: { text: "Start Speaking", href: "/all-courses" },
      secondaryCta: { text: "Try a Lesson", href: "#section-phrases-language-1" },
    } satisfies NicheCtaContent,
  },

  "features-skills": {
    type: "features-skills",
    name: "Features: Skills",
    description: "Animated feature cards with a skills motif",
    category: "features",
    icon: "rocket",
    variants: [{ id: "default", name: "Default", description: "Animated feature grid" }],
    defaultContent: {
      headline: "Skills That Get You Hired and Promoted",
      subheadline: "Practical, project-based learning in the skills employers want most.",
      items: [
        { id: "f1", icon: "rocket", title: "Career-Focused", description: "Built around real job outcomes." },
        { id: "f2", icon: "zap", title: "Learn Fast", description: "Skip theory overload, build real things." },
        { id: "f3", icon: "target", title: "Job-Ready Projects", description: "Graduate with a portfolio, not just notes." },
        { id: "f4", icon: "trophy", title: "Recognized Certificates", description: "Showcase credentials employers trust." },
        { id: "f5", icon: "users", title: "Mentor Support", description: "Get help from industry pros." },
        { id: "f6", icon: "book", title: "Always Up to Date", description: "Content that keeps pace with the industry." },
      ],
    } satisfies NicheFeaturesContent,
  },
  "testimonials-skills": {
    type: "testimonials-skills",
    name: "Testimonials: Skills",
    description: "Testimonial cards with a skills motif",
    category: "social-proof",
    icon: "rocket",
    variants: [{ id: "default", name: "Default", description: "Testimonial card grid" }],
    defaultContent: {
      headline: "Career Success Stories",
      subheadline: "Learners who leveled up and got hired.",
      items: [
        { id: "t1", name: "Neha Kapoor", role: "Data Analyst", quote: "I switched careers in four months. The projects got me the interview and the offer.", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80", rating: 5 },
        { id: "t2", name: "Sam Wright", role: "UX Designer", quote: "Graduated with a portfolio that actually landed me a job.", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80", rating: 5 },
        { id: "t3", name: "Ibrahim Ali", role: "Marketer", quote: "Practical, current, and taught by people who do this for real.", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80", rating: 5 },
      ],
    } satisfies NicheTestimonialsContent,
  },
  "cta-skills": {
    type: "cta-skills",
    name: "CTA: Skills",
    description: "Gradient CTA with a skills motif",
    category: "conversion",
    icon: "rocket",
    variants: [{ id: "default", name: "Default", description: "Gradient CTA banner" }],
    defaultContent: {
      headline: "Build the Skills Employers Want",
      subheadline: "Start a project-based track and level up your career.",
      primaryCta: { text: "Explore Skills", href: "/all-courses" },
      secondaryCta: { text: "Browse Tracks", href: "#section-tracks-skills-1" },
    } satisfies NicheCtaContent,
  },

  "about-photography": {
    type: "about-photography",
    name: "About: Photography",
    description: "Instructor showcase with image, bio, and credential cards in neo-brutalist style",
    category: "content",
    icon: "user",
    variants: [
      { id: "default", name: "Default", description: "Two-column layout with image and bio" },
    ],
    defaultContent: {
      headline: "Learn from",
      headlineAccent: "the Best",
      description:
        "With over 15 years of experience capturing moments across 40+ countries, I've worked with National Geographic, Vogue, and TIME Magazine. Now, I'm sharing everything I know with aspiring photographers like you.",
      secondaryDescription:
        "My teaching philosophy is simple: master the fundamentals, develop your unique vision, and never stop experimenting. Whether you're picking up a camera for the first time or looking to refine your professional skills, my courses will take you there.",
      image: "https://images.unsplash.com/photo-1554048612-b6a482bc67e5?w=800&q=80",
      imageAlt: "Professional photographer holding camera",
      credentials: [
        {
          id: "1",
          icon: "award",
          title: "Award Winning",
          description: "Multiple international photography awards",
        },
        {
          id: "2",
          icon: "graduation-cap",
          title: "Certified",
          description: "Accredited courses with certificates",
        },
      ],
    } satisfies AboutPhotographyContent,
  },

  "features-photography": {
    type: "features-photography",
    name: "Features: Photography",
    description: "4-column feature grid with icons in neo-brutalist card style",
    category: "features",
    icon: "grid-2x2",
    variants: [{ id: "default", name: "Default", description: "4-column grid with icon cards" }],
    defaultContent: {
      headline: "What You Get",
      features: [
        {
          id: "1",
          icon: "video",
          title: "HD Video Lessons",
          description: "Over 200 hours of premium video content with lifetime access",
        },
        {
          id: "2",
          icon: "users",
          title: "Community Access",
          description: "Join 12,000+ photographers in our exclusive community",
        },
        {
          id: "3",
          icon: "message-circle",
          title: "Personal Feedback",
          description: "Get direct feedback on your work from expert instructors",
        },
        {
          id: "4",
          icon: "download",
          title: "Resources",
          description: "Downloadable presets, templates, and shooting guides",
        },
      ],
    } satisfies FeaturesPhotographyContent,
  },

  "gallery-photography": {
    type: "gallery-photography",
    name: "Gallery: Photography",
    description: "Student work gallery grid with neo-brutalist bordered images",
    category: "content",
    icon: "image",
    variants: [{ id: "default", name: "Default", description: "4-column image grid" }],
    defaultContent: {
      headline: "Student Work",
      description: "See what our students have created after taking our courses",
      items: [
        {
          id: "1",
          image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&q=80",
          alt: "Portrait photography",
        },
        {
          id: "2",
          image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80",
          alt: "Landscape photography",
        },
        {
          id: "3",
          image: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=600&q=80",
          alt: "Street photography",
        },
        {
          id: "4",
          image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&q=80",
          alt: "Product photography",
        },
        {
          id: "5",
          image: "https://images.unsplash.com/photo-1519741497674-611481863552?w=600&q=80",
          alt: "Wedding photography",
        },
        {
          id: "6",
          image: "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=600&q=80",
          alt: "Nature close-up photography",
        },
        {
          id: "7",
          image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=80",
          alt: "Fashion photography",
        },
        {
          id: "8",
          image: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=600&q=80",
          alt: "Architecture photography",
        },
      ],
    } satisfies GalleryPhotographyContent,
  },

  "testimonials-photography": {
    type: "testimonials-photography",
    name: "Testimonials: Photography",
    description: "Success stories with star ratings in neo-brutalist card style",
    category: "social-proof",
    icon: "quote",
    variants: [{ id: "default", name: "Default", description: "3-column testimonial cards" }],
    defaultContent: {
      headline: "Success Stories",
      testimonials: [
        {
          id: "1",
          quote:
            "This course completely transformed my photography. I went from shooting on auto mode to confidently shooting manual and landing paid gigs within 3 months!",
          author: "Emma Rodriguez",
          role: "Portrait Photographer",
          rating: 5,
        },
        {
          id: "2",
          quote:
            "The instructor's teaching style is incredible. Complex concepts are broken down so clearly. I've learned more in 8 weeks than in years of trying to teach myself.",
          author: "Michael Chen",
          role: "Landscape Photographer",
          rating: 5,
        },
        {
          id: "3",
          quote:
            "Best investment I've made in my photography career. The community alone is worth it - so much support and inspiration from fellow students and instructors.",
          author: "Sarah Williams",
          role: "Wedding Photographer",
          rating: 5,
        },
      ],
    } satisfies TestimonialsPhotographyContent,
  },

  "faq-photography": {
    type: "faq-photography",
    name: "FAQ: Photography",
    description: "FAQ accordion with neo-brutalist card styling",
    category: "conversion",
    icon: "help-circle",
    variants: [{ id: "default", name: "Default", description: "Stacked FAQ cards" }],
    defaultContent: {
      headline: "FAQ",
      items: [
        {
          id: "1",
          question: "Do I need expensive equipment to start?",
          answer:
            "No! You can start with any camera, even a smartphone. We focus on fundamentals that apply to any equipment. As you progress, we'll guide you on smart gear investments.",
        },
        {
          id: "2",
          question: "How long do I have access to the courses?",
          answer:
            "With monthly and annual plans, you have access as long as your subscription is active. Lifetime members get permanent access to all current and future courses.",
        },
        {
          id: "3",
          question: "Are the courses suitable for complete beginners?",
          answer:
            "Absolutely! We have courses designed specifically for beginners that start with the basics. Our structured curriculum takes you from zero to advanced at your own pace.",
        },
        {
          id: "4",
          question: "Can I get a refund if I'm not satisfied?",
          answer:
            "Yes, we offer a 30-day money-back guarantee. If you're not completely satisfied with the courses, we'll refund your payment, no questions asked.",
        },
        {
          id: "5",
          question: "Will I receive a certificate?",
          answer:
            "Yes! Upon completing each course, you'll receive a certificate of completion that you can add to your portfolio and share on professional networks.",
        },
      ],
    } satisfies FaqPhotographyContent,
  },

  "books-listing-photography": {
    type: "books-listing-photography",
    name: "Browse Books: Photography",
    description: "Neo-brutalist book card grid with thick borders, gold accent, and author info",
    category: "catalog",
    icon: "book-open",
    variants: [{ id: "default", name: "Default", description: "Book card grid" }],
    defaultContent: {
      headline: "Browse Books",
      subheadline:
        "Expand your knowledge with our curated collection of photography and creative books",
    } satisfies ContentListingContent,
  },

  "courses-listing-photography": {
    type: "courses-listing-photography",
    name: "Featured Courses: Photography",
    description:
      "Neo-brutalist course card grid with thick borders, gold accent pricing, and level badges",
    category: "catalog",
    icon: "layout-grid",
    variants: [{ id: "default", name: "Default", description: "3-column course card grid" }],
    defaultContent: {
      headline: "Featured Courses",
      subheadline:
        "From beginner fundamentals to advanced techniques, find the perfect course to elevate your photography skills",
    } satisfies ContentListingContent,
  },

  "cta-photography": {
    type: "cta-photography",
    name: "CTA: Photography",
    description: "Bold call-to-action section with neo-brutalist styling",
    category: "conversion",
    icon: "megaphone",
    variants: [{ id: "default", name: "Default", description: "Centered CTA with guarantee text" }],
    defaultContent: {
      headline: "Start Your",
      headlineAccent: "Journey Today",
      description:
        "Join thousands of photographers who have transformed their passion into a profession",
      primaryCta: { text: "Enroll Now", href: "/all-courses", variant: "primary" },
      secondaryCta: { text: "View All Courses", href: "/all-courses", variant: "outline" },
      guaranteeText: "30-Day Money-Back Guarantee • No Risk",
    } satisfies CtaPhotographyContent,
  },

  // ────────────────────────────────────
  // Astrology Landing Page Sections
  // ────────────────────────────────────

  "hero-astrology": {
    type: "hero-astrology",
    name: "Hero: Astrology",
    description: "Slider-based hero with cosmic celestial aesthetics and auto-rotating backgrounds",
    category: "hero",
    icon: "sparkles",
    variants: [
      { id: "default", name: "Default", description: "Celestial slider hero" },
    ],
    defaultContent: {
      headline: "Unlock the Secrets",
      headlineAccent: "of the Stars",
      description: "Discover your cosmic path through ancient wisdom and modern astrological insights. Learn from master astrologers who have guided thousands on their celestial journey.",
      primaryCta: { text: "Begin Your Journey", href: "#section-courses-listing-astrology-2", variant: "primary" },
      secondaryCta: { text: "Explore Services", href: "#services-astrology", variant: "outline" },
      slides: [
        { id: "slide-1", image: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1600&q=80", imageAlt: "Celestial night sky with stars" },
        { id: "slide-2", image: "https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?w=1600&q=80", imageAlt: "Starry cosmos and galaxy" },
        { id: "slide-3", image: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1600&q=80", imageAlt: "Nebula and cosmic clouds" },
      ],
      stats: [
        { id: "stat-1", value: "10,000+", label: "Students Guided" },
        { id: "stat-2", value: "500+", label: "Chart Readings" },
        { id: "stat-3", value: "12", label: "Zodiac Courses" },
      ],
    } satisfies HeroAstrologyContent,
  },

  "about-astrology": {
    type: "about-astrology",
    name: "About: Astrology",
    description: "Instructor bio section with celestial credential cards",
    category: "content",
    icon: "user",
    variants: [
      { id: "default", name: "Default", description: "Two-column with credentials" },
    ],
    defaultContent: {
      headline: "Your Guide to the",
      headlineAccent: "Celestial Realm",
      description: "With over two decades of experience in Vedic and Western astrology, our teachings blend ancient wisdom with modern psychological insights to help you understand your cosmic blueprint.",
      secondaryDescription: "Every soul has a unique celestial map. Our mission is to help you read yours and navigate life with clarity and purpose.",
      image: "",
      imageAlt: "Astrologer",
      credentials: [
        { id: "cred-1", icon: "star", title: "Certified Astrologer", description: "Internationally accredited in Vedic & Western astrology" },
        { id: "cred-2", icon: "moon", title: "Spiritual Mentor", description: "Guiding seekers on their cosmic journey since 2005" },
      ],
    } satisfies AboutAstrologyContent,
  },

  "services-astrology": {
    type: "services-astrology",
    name: "Services: Astrology",
    description: "Service/offering cards with cosmic glass-morphism design",
    category: "features",
    icon: "compass",
    variants: [
      { id: "default", name: "Default", description: "Service card grid" },
    ],
    defaultContent: {
      headline: "Celestial Services",
      description: "Explore our range of astrological services designed to illuminate your path",
      services: [
        { id: "svc-1", icon: "sun", title: "Birth Chart Reading", description: "A comprehensive analysis of your natal chart revealing your life purpose, strengths, and karmic patterns" },
        { id: "svc-2", icon: "moon", title: "Transit Forecast", description: "Understand upcoming planetary transits and how they will influence your personal and professional life" },
        { id: "svc-3", icon: "star", title: "Compatibility Analysis", description: "Discover the cosmic harmony between you and your partner through synastry chart comparison" },
        { id: "svc-4", icon: "compass", title: "Career Guidance", description: "Align your professional path with your celestial blueprint for fulfillment and success" },
      ],
    } satisfies ServicesAstrologyContent,
  },

  "testimonials-astrology": {
    type: "testimonials-astrology",
    name: "Testimonials: Astrology",
    description: "Student testimonials with star ratings and elegant styling",
    category: "social-proof",
    icon: "message-circle",
    variants: [
      { id: "default", name: "Default", description: "Testimonial cards" },
    ],
    defaultContent: {
      headline: "Words from the Stars",
      testimonials: [
        { id: "test-1", quote: "The birth chart reading was incredibly accurate and deeply insightful. It helped me understand patterns I had been struggling with for years.", author: "Sarah M.", role: "Vedic Astrology Student", rating: 5 },
        { id: "test-2", quote: "This course transformed my understanding of astrology from surface-level horoscopes to a profound tool for self-discovery.", author: "James K.", role: "Professional Astrologer", rating: 5 },
        { id: "test-3", quote: "The transit forecast prepared me for a major life transition. I felt guided and supported throughout the entire journey.", author: "Priya R.", role: "Spiritual Seeker", rating: 5 },
      ],
    } satisfies TestimonialsAstrologyContent,
  },

  "faq-astrology": {
    type: "faq-astrology",
    name: "FAQ: Astrology",
    description: "Frequently asked questions with celestial-themed accordion",
    category: "content",
    icon: "help-circle",
    variants: [
      { id: "default", name: "Default", description: "Accordion FAQ" },
    ],
    defaultContent: {
      headline: "Frequently Asked Questions",
      items: [
        { id: "faq-1", question: "Do I need prior astrology knowledge to take these courses?", answer: "Not at all! Our courses are designed for all levels. Beginners start with foundational concepts while advanced students can dive into specialized topics like predictive astrology and chart rectification." },
        { id: "faq-2", question: "What is the difference between Vedic and Western astrology?", answer: "Vedic astrology (Jyotish) uses the sidereal zodiac and emphasizes karma and spiritual growth, while Western astrology uses the tropical zodiac and focuses on psychological patterns. Both systems offer valuable insights." },
        { id: "faq-3", question: "How accurate are astrological readings?", answer: "Astrology provides a framework for understanding cosmic influences on our lives. The accuracy depends on the precision of birth data and the skill of the astrologer. Our readings use exact calculations and decades of interpretive experience." },
        { id: "faq-4", question: "Can I get a personal reading in addition to the courses?", answer: "Yes! We offer one-on-one birth chart readings, transit consultations, and compatibility analyses. These can complement your course learning with personalized insights." },
      ],
    } satisfies FaqAstrologyContent,
  },

  "cta-astrology": {
    type: "cta-astrology",
    name: "CTA: Astrology",
    description: "Cosmic call-to-action section with celestial aesthetics",
    category: "conversion",
    icon: "megaphone",
    variants: [
      { id: "default", name: "Default", description: "Centered CTA with guarantee" },
    ],
    defaultContent: {
      headline: "Begin Your",
      headlineAccent: "Cosmic Journey",
      description: "Join thousands of seekers who have discovered their celestial path. Your stars are waiting to be read.",
      backgroundImage: "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=1600&q=80",
      primaryCta: { text: "Start Learning", href: "#section-courses-listing-astrology-2", variant: "primary" },
      secondaryCta: { text: "Book a Reading", href: "#books-listing-astrology", variant: "outline" },
      guaranteeText: "30-Day Satisfaction Guarantee • Cancel Anytime",
    } satisfies CtaAstrologyContent,
  },

  "courses-listing-astrology": {
    type: "courses-listing-astrology",
    name: "Featured Courses: Astrology",
    description: "Celestial course card grid with cosmic styling",
    category: "catalog",
    icon: "layout-grid",
    variants: [
      { id: "default", name: "Default", description: "Course card grid" },
    ],
    defaultContent: {
      headline: "Celestial Courses",
      subheadline: "Master the art and science of astrology with our expertly crafted courses",
    } satisfies ContentListingContent,
  },

  "self-paced-courses-listing-astrology": {
    type: "self-paced-courses-listing-astrology",
    name: "Self-Paced Courses: Astrology",
    description: "Self-paced course listing cards",
    category: "ecommerce",
    icon: "play-circle",
    variants: [{ id: "default", name: "Default", description: "Course cards grid" }],
    defaultContent: {
      headline: "Self-Paced Courses",
      subheadline: "Learn astrology at your own pace with recorded lessons",
      itemCount: 6,
      seeAllLink: "/all-courses",
    } satisfies ContentListingContent,
  },

  "books-listing-astrology": {
    type: "books-listing-astrology",
    name: "Browse Books: Astrology",
    description: "Celestial book card grid with cosmic styling",
    category: "catalog",
    icon: "book-open",
    variants: [
      { id: "default", name: "Default", description: "Book card grid" },
    ],
    defaultContent: {
      headline: "Sacred Texts",
      subheadline: "Deepen your astrological knowledge with our curated collection of books and guides",
    } satisfies ContentListingContent,
  },

  "subscription-hero": {
    type: "subscription-hero",
    name: "Subscription Hero",
    description: "Hero banner for subscription landing page",
    category: "subscription",
    icon: "crown",
    variants: [{ id: "default", name: "Default", description: "Default layout" }],
    defaultContent: {
      headline: "Invest in Yourself.",
      subheadline: "Get unlimited access to all content with a single subscription.",
      primaryCta: { text: "Get Started", href: "#pricing", variant: "primary" },
      secondaryCta: { text: "See What's Included", href: "#features", variant: "outline" },
      trustBadges: [
        { id: "1", label: "Secure payment" },
        { id: "2", label: "Cancel anytime" },
        { id: "3", label: "Instant access" },
      ],
      stats: [
        { id: "1", value: "50+", label: "Courses" },
        { id: "2", value: "100+", label: "Projects" },
        { id: "3", value: "10+", label: "Books & PDFs" },
      ],
    } satisfies SubscriptionHeroContent,
  },

  "subscription-features": {
    type: "subscription-features",
    name: "Subscription Features",
    description: "Feature categories showcasing subscriber benefits",
    category: "subscription",
    icon: "sparkles",
    variants: [{ id: "default", name: "Default", description: "Category groups" }],
    defaultContent: {
      headline: "Everything You Need to Succeed",
      subheadline: "Your subscription includes access to all of these features and more.",
      categories: [
        {
          id: "1",
          label: "LEARNING HUB",
          subtitle: "World-class courses and resources at your fingertips",
          items: [
            {
              id: "1",
              title: "All courses included",
              description: "Access every course in our library",
            },
            { id: "2", title: "New content weekly", description: "Fresh content added regularly" },
            { id: "3", title: "Downloadable resources", description: "PDFs, templates, and more" },
          ],
        },
        {
          id: "2",
          label: "COMMUNITY",
          subtitle: "Connect and grow with like-minded learners",
          items: [
            { id: "4", title: "Discussion forums", description: "Engage with fellow learners" },
            { id: "5", title: "Expert Q&A", description: "Get answers from instructors" },
            { id: "6", title: "Certificates", description: "Earn certificates on completion" },
          ],
        },
      ],
    } satisfies SubscriptionFeaturesContent,
  },

  "subscription-comparison": {
    type: "subscription-comparison",
    name: "Subscription Comparison",
    description: "Free vs paid feature comparison",
    category: "subscription",
    icon: "table",
    variants: [{ id: "default", name: "Default", description: "Two-column comparison" }],
    defaultContent: {
      headline: "Free vs Plus",
      subheadline: "See what you get with a subscription.",
      freeColumnLabel: "Free",
      paidColumnLabel: "Plus",
      rows: [
        { id: "1", feature: "Browse course catalog", freeValue: true, paidValue: true },
        { id: "2", feature: "Access free courses", freeValue: true, paidValue: true },
        { id: "3", feature: "Access premium courses", freeValue: false, paidValue: true },
        { id: "4", feature: "Download resources", freeValue: false, paidValue: true },
        { id: "5", feature: "Certificates of completion", freeValue: false, paidValue: true },
        { id: "6", feature: "Priority support", freeValue: false, paidValue: true },
      ],
    } satisfies SubscriptionComparisonContent,
  },

  "subscription-pricing": {
    type: "subscription-pricing",
    name: "Subscription Pricing",
    description: "Live pricing card, plan data from API at render time",
    category: "subscription",
    icon: "credit-card",
    variants: [{ id: "default", name: "Default", description: "Pricing card with toggles" }],
    defaultContent: {
      headline: "Simple, Transparent Pricing",
      subheadline: "Choose the plan that works for you. Cancel anytime.",
      ctaText: "Subscribe Now",
      showCouponField: false,
      features: [
        "Unlimited access to all courses",
        "New content added weekly",
        "Downloadable resources & PDFs",
        "Certificates of completion",
        "Priority support",
      ],
    } satisfies SubscriptionPricingContent,
  },

  "subscription-faq": {
    type: "subscription-faq",
    name: "Subscription FAQ",
    description: "Frequently asked questions about the subscription",
    category: "subscription",
    icon: "help-circle",
    variants: [{ id: "default", name: "Default", description: "Accordion FAQ" }],
    defaultContent: {
      headline: "Frequently Asked Questions",
      subheadline: "Have questions? We have answers.",
      items: [
        {
          id: "1",
          question: "Can I cancel anytime?",
          answer:
            "Yes, you can cancel your subscription at any time. You'll continue to have access until the end of your billing period.",
        },
        {
          id: "2",
          question: "Is there a free trial?",
          answer: "Some plans include a free trial period. Check the pricing section for details.",
        },
        {
          id: "3",
          question: "What payment methods do you accept?",
          answer:
            "We accept all major credit/debit cards and UPI payments through our secure payment partner.",
        },
        {
          id: "4",
          question: "Can I switch between monthly and yearly?",
          answer:
            "Yes, you can switch your billing cycle at any time. Changes take effect at the start of your next billing period.",
        },
        {
          id: "5",
          question: "What happens to my progress if I cancel?",
          answer:
            "Your course progress and certificates are saved even after cancellation. You can resume where you left off if you resubscribe.",
        },
      ],
    } satisfies SubscriptionFaqContent,
  },

  "subscription-cta": {
    type: "subscription-cta",
    name: "Subscription CTA",
    description: "Call-to-action banner encouraging subscription",
    category: "subscription",
    icon: "zap",
    variants: [{ id: "default", name: "Default", description: "CTA banner" }],
    defaultContent: {
      headline: "Ready to Start Learning?",
      subheadline:
        "Join thousands of learners who have transformed their careers with our platform.",
      primaryCta: { text: "Get Started Today", href: "#pricing", variant: "primary" },
    } satisfies SubscriptionCtaContent,
  },

  // ── Mindfulness Template Sections ──

  "hero-mindfulness": {
    type: "hero-mindfulness",
    name: "Hero: Mindfulness",
    description: "Serene hero section with meditation imagery, wellness stats, and benefits bar",
    category: "hero",
    icon: "heart",
    variants: [
      { id: "default", name: "Default", description: "Two-column layout with image and stats" },
    ],
    defaultContent: {
      headline: "Find Your Path to",
      headlineAccent: "Inner Peace",
      description: "Learn from expert instructors. Master meditation, breathwork, and mindfulness through live sessions and comprehensive courses designed for your journey.",
      primaryCta: { text: "Start Learning Free", href: "/login", variant: "primary" },
      secondaryCta: { text: "Watch Demo", href: "/", variant: "outline" },
      image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80",
      imageAlt: "Person meditating in a serene natural setting",
      liveBadgeText: "Live Now",
      stats: [
        { id: "1", icon: "heart-pulse", label: "Stress", value: "-65%" },
        { id: "2", icon: "moon", label: "Sleep", value: "8.5h" },
        { id: "3", icon: "brain", label: "Focus", value: "+42%" },
      ],
      benefits: [
        { id: "1", icon: "shield-check", label: "Science-Backed Methods" },
        { id: "2", icon: "clock", label: "Learn at Your Pace" },
        { id: "3", icon: "award", label: "Certified Instructors" },
        { id: "4", icon: "smartphone", label: "Access Anywhere" },
      ],
    } satisfies HeroMindfulnessContent,
  },

  "teach-mindfulness": {
    type: "teach-mindfulness",
    name: "Learn: Mindfulness",
    description: "CTA section inviting learners to start their mindfulness journey",
    category: "conversion",
    icon: "presentation",
    variants: [
      { id: "default", name: "Default", description: "Two-column card with meditation illustration and CTA" },
    ],
    defaultContent: {
      badge: "Start Your Mindfulness Journey",
      headline: "Learn at Your Own Pace.",
      headlineAccent: "Grow Every Day.",
      description: "Explore guided courses, live sessions, and curated paths designed by expert instructors. Build a daily practice that fits your life.",
      primaryCta: { text: "Explore Courses", href: "/all-courses", variant: "primary" },
    } satisfies TeachMindfulnessContent,
  },

  "how-it-works-mindfulness": {
    type: "how-it-works-mindfulness",
    name: "How It Works: Mindfulness",
    description: "Four-step process cards showing the learner journey",
    category: "features",
    icon: "list-checks",
    variants: [
      { id: "default", name: "Default", description: "Four-column step cards with icons" },
    ],
    defaultContent: {
      headline: "How it",
      headlineAccent: "works",
      description: "Simple steps to start your mindfulness journey.",
      steps: [
        { id: "1", icon: "search", stepLabel: "STEP 1", title: "Browse", description: "Explore thousands of sessions, courses, and programs." },
        { id: "2", icon: "shopping-cart", stepLabel: "STEP 2", title: "Purchase", description: "Enroll in live sessions or purchase courses instantly." },
        { id: "3", icon: "graduation-cap", stepLabel: "STEP 3", title: "Learn", description: "Practice with expert guidance at your own pace." },
        { id: "4", icon: "star", stepLabel: "STEP 4", title: "Evolve", description: "Transform your life through consistent practice." },
      ],
    } satisfies HowItWorksMindfulnessContent,
  },

  "testimonials-mindfulness": {
    type: "testimonials-mindfulness",
    name: "Testimonials: Mindfulness",
    description: "Horizontal scroll testimonials from learners and instructors",
    category: "social-proof",
    icon: "message-circle",
    variants: [
      { id: "default", name: "Default", description: "Horizontal scroll with role badges" },
    ],
    defaultContent: {
      headline: "Stories of",
      headlineAccent: "transformation",
      description: "From learners and instructors building their dreams.",
      testimonials: [
        { id: "1", name: "Sarah Jenkins", role: "learner", quote: "Found the perfect sleep program that changed my nights. The variety of instructors means I can always find someone who resonates with me.", rating: 5 },
        { id: "2", name: "David Chen", role: "instructor", quote: "Serene gave me the platform to reach students globally. In 6 months, I've earned over $15K teaching what I love while making a real impact.", rating: 5 },
        { id: "3", name: "Emma Thompson", role: "learner", quote: "The live sessions feel so personal and the recorded courses let me practice on my schedule. Best mindfulness investment I've made.", rating: 5 },
        { id: "4", name: "Priya Sharma", role: "instructor", quote: "The tools make it so easy to create and manage courses. I focus on teaching, and everything else is handled. My students love the experience!", rating: 5 },
      ],
    } satisfies TestimonialsMindfulnessContent,
  },

  "cta-mindfulness": {
    type: "cta-mindfulness",
    name: "CTA: Mindfulness",
    description: "Full-width gradient CTA section with trust badges",
    category: "conversion",
    icon: "sparkles",
    variants: [
      { id: "default", name: "Default", description: "Gradient background with centered CTA" },
    ],
    defaultContent: {
      badge: "Join 50,000+ on Their Journey",
      headline: "Begin Your Path to",
      headlineAccent: "Inner Peace",
      description: "Whether you're seeking tranquility or ready to guide others toward mindfulness, your transformative journey starts here.",
      primaryCta: { text: "Explore Courses", href: "/all-courses", variant: "primary" },
    } satisfies CtaMindfulnessContent,
  },

  "roadmap-mindfulness": {
    type: "roadmap-mindfulness",
    name: "Roadmap: Mindfulness",
    description: "Visual winding-path illustration showing curated learning journeys toward a goal",
    category: "features",
    icon: "route",
    variants: [
      { id: "default", name: "Default", description: "Winding path with waypoint markers" },
    ],
    defaultContent: {
      headline: "Curated Learning",
      headlineAccent: "Paths",
      description: "Follow structured journeys designed by expert instructors. Each path guides you step-by-step toward mastery, at your own pace.",
      waypoints: [
        { id: "1", label: "Discover", icon: "compass" },
        { id: "2", label: "Learn", icon: "book" },
        { id: "3", label: "Practice", icon: "repeat" },
        { id: "4", label: "Grow", icon: "sprout" },
        { id: "5", label: "Master", icon: "trophy" },
      ],
      goalLabel: "Inner Peace",
      primaryCta: { text: "Start Your Journey", href: "/all-courses", variant: "primary" },
    } satisfies RoadmapMindfulnessContent,
  },

  // ============================================
  // Exam Prep Template Sections
  // ============================================

  "hero-examprep": {
    type: "hero-examprep",
    name: "Hero: IIT JEE / NEET",
    description: "Two-column hero with badge, headline, CTA, image, and background blurs",
    category: "hero",
    icon: "graduation-cap",
    variants: [
      { id: "default", name: "Default", description: "Split layout with image and stats" },
    ],
    defaultContent: {
      badge: "India's Most Trusted IIT JEE / NEET Platform",
      headline: "Master Your",
      headlineAccent: "IIT JEE / NEET Journey with Expert Educators",
      description: "Join thousands of successful candidates. Get personalized study plans, expert faculty guidance, and comprehensive preparation ecosystem for IIT JEE and NEET all in one platform.",
      primaryCta: { text: "Explore Courses", href: "/all-courses", variant: "primary" },
      image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=600&fit=crop",
      imageAlt: "Students studying together with laptops and books for IIT JEE and NEET",
      stats: [],
    } satisfies HeroExamprepContent,
  },

  "features-examprep": {
    type: "features-examprep",
    name: "Features: IIT JEE / NEET",
    description: "Six-card feature grid with colored icon accents and hover effects",
    category: "features",
    icon: "layout-grid",
    variants: [
      { id: "default", name: "Default", description: "3-column responsive grid" },
    ],
    defaultContent: {
      headline: "Everything You Need to",
      headlineAccent: "Crack Your Dream Exam",
      description: "Comprehensive preparation ecosystem for IIT JEE / NEET powered by expert faculty",
      features: [
        { id: "1", icon: "presentation", title: "Live Interactive Classes", description: "Join live sessions with top JEE / NEET educators, participate in discussions, and get instant doubt clearing." },
        { id: "2", icon: "file-text", title: "Mock Tests / Analysis", description: "Practice with exam-pattern mock tests and get detailed performance analysis with improvement suggestions." },
        { id: "3", icon: "mic", title: "AI Mock Interviews", description: "Practice personality tests with AI-powered mock interviews and get detailed feedback on your performance." },
        { id: "4", icon: "book-open", title: "Study Materials / Books", description: "Access comprehensive study materials, curated books, and resources for JEE / NEET preparation." },
        { id: "5", icon: "bar-chart", title: "Progress Tracking", description: "Monitor your preparation journey with detailed analytics, performance trends, and milestone achievements." },
        { id: "6", icon: "video", title: "Recorded Self-Paced Courses", description: "Learn at your own pace with high-quality recorded lectures available 24/7 for all subjects." },
      ],
    } satisfies FeaturesExamprepContent,
  },

  "learning-paths-examprep": {
    type: "learning-paths-examprep",
    name: "Learning Paths: IIT JEE / NEET",
    description: "Visual winding roadmap showing the structured learning journey",
    category: "features",
    icon: "route",
    variants: [
      { id: "default", name: "Default", description: "Winding path with waypoint markers" },
    ],
    defaultContent: {
      headline: "Comprehensive",
      headlineAccent: "Learning Paths",
      description: "Structured roadmaps designed by experts to guide you from beginner to exam-ready",
      waypoints: [
        { id: "wp-1", label: "Foundation", icon: "book" },
        { id: "wp-2", label: "Practice", icon: "repeat" },
        { id: "wp-3", label: "Mock Tests", icon: "compass" },
        { id: "wp-4", label: "Revision", icon: "sprout" },
        { id: "wp-5", label: "Exam Ready", icon: "trophy" },
      ],
      goalLabel: "Success",
    } satisfies RoadmapMindfulnessContent,
  },

  "about-examprep": {
    type: "about-examprep",
    name: "About: IIT JEE / NEET",
    description: "Two-column about section with faculty image, credentials, and CTA",
    category: "content",
    icon: "users",
    variants: [
      { id: "default", name: "Default", description: "Image left, content right layout" },
    ],
    defaultContent: {
      badge: "Expert Faculty Team",
      headline: "Learn from",
      headlineAccent: "India's Best Educators",
      description: "Our faculty comprises IITians, AIIMS doctors, and subject matter experts with decades of experience in coaching JEE and NEET aspirants.",
      image: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&h=600&fit=crop",
      imageAlt: "Experienced faculty mentor guiding students in a modern classroom environment",
      credentials: [
        { id: "1", icon: "check", title: "25+ Years Combined Experience", description: "Our faculty has successfully mentored thousands of JEE / NEET aspirants" },
        { id: "2", icon: "check", title: "Personalized Mentorship", description: "One-on-one guidance tailored to your learning pace and goals" },
        { id: "3", icon: "check", title: "Proven Track Record", description: "2800+ selections across IITs and Medical colleges in last 5 years" },
      ],
    } satisfies AboutExamprepContent,
  },

  "testimonials-examprep": {
    type: "testimonials-examprep",
    name: "Testimonials: IIT JEE / NEET",
    description: "Success stories grid with ratings, quotes, and avatar initials",
    category: "social-proof",
    icon: "message-square",
    variants: [
      { id: "default", name: "Default", description: "Three-column testimonial cards" },
    ],
    defaultContent: {
      headline: "Success",
      headlineAccent: "Stories",
      description: "Hear from JEE / NEET toppers who achieved their dreams with our platform",
      testimonials: [
        { id: "1", name: "Ananya Patel", role: "AIR 23, CSE 2023", quote: "The AI study assistant and mock interviews were game-changers for me. The personalized study plan helped me cover the entire syllabus systematically. Highly recommend!", rating: 5, initials: "AP" },
        { id: "2", name: "Rajesh Sharma", role: "AIR 67, CSE 2023", quote: "Being a working professional, the flexibility of self-paced courses was perfect. The quality of content and test series is unmatched. Worth every penny!", rating: 5, initials: "RS" },
        { id: "3", name: "Priya Krishnan", role: "AIR 142, CSE 2023", quote: "The faculty's expertise and the detailed performance analytics helped me identify and work on my weak areas. The community support was incredible too!", rating: 5, initials: "PK" },
      ],
    } satisfies TestimonialsExamprepContent,
  },

  "faq-examprep": {
    type: "faq-examprep",
    name: "FAQ: IIT JEE / NEET",
    description: "Accordion FAQ section with expandable question-answer pairs",
    category: "conversion",
    icon: "help-circle",
    variants: [
      { id: "default", name: "Default", description: "Centered accordion layout" },
    ],
    defaultContent: {
      headline: "Frequently Asked",
      headlineAccent: "Questions",
      description: "Everything you need to know about our platform",
      items: [
        { id: "1", question: "What is the refund policy?", answer: "We offer a 100% money-back guarantee within 7 days of enrollment if you're not satisfied with the course. For Elite plan subscribers, we provide a full refund if you don't qualify for your target exam after completing the entire course as per guidelines." },
        { id: "2", question: "Can I access courses on mobile devices?", answer: "Yes! Our platform is fully responsive and works seamlessly on all devices including smartphones, tablets, and desktops. You can also download our mobile app for offline access to video lectures." },
        { id: "3", question: "How does the AI study assistant work?", answer: "Our AI study assistant analyzes your performance, learning pace, and weak areas to create personalized study plans. It provides instant doubt resolution, recommends relevant content, and adapts to your progress in real-time." },
        { id: "4", question: "Are live classes recorded?", answer: "Yes, all live classes are recorded and available for replay within 24 hours. You can watch them unlimited times throughout your subscription period. Recordings include searchable transcripts for easy navigation." },
        { id: "5", question: "Do you provide answer writing evaluation?", answer: "Yes, Pro and Elite plan subscribers get personalized answer writing evaluation by expert faculty. You can submit answers through the platform and receive detailed feedback within 48 hours with improvement suggestions." },
        { id: "6", question: "Can I switch between plans?", answer: "Absolutely! You can upgrade your plan anytime by paying the difference. Downgrades are processed at the next billing cycle. All your progress and data remain intact during plan changes." },
      ],
    } satisfies FaqExamprepContent,
  },

  "cta-examprep": {
    type: "cta-examprep",
    name: "CTA: IIT JEE / NEET",
    description: "Gradient call-to-action banner with headline, description, and button",
    category: "conversion",
    icon: "megaphone",
    variants: [
      { id: "default", name: "Default", description: "Full-width gradient CTA" },
    ],
    defaultContent: {
      headline: "Ready to Start Your Preparation Journey?",
      description: "Join thousands of successful aspirants and get access to India's most comprehensive preparation platform for IIT JEE and NEET",
      primaryCta: { text: "Explore Courses", href: "/all-courses", variant: "primary" },
    } satisfies CtaExamprepContent,
  },

  "courses-listing-examprep": {
    type: "courses-listing-examprep",
    name: "Courses: IIT JEE / NEET",
    description: "Course listing cards with images, ratings, pricing, and enrollment",
    category: "ecommerce",
    icon: "book-open",
    variants: [
      { id: "default", name: "Default", description: "Three-column course cards" },
    ],
    defaultContent: {
      headline: "All Courses",
      subheadline: "Choose the perfect course for your preparation journey",
      itemCount: 6,
      seeAllLink: "/all-courses",
    } satisfies ContentListingContent,
  },

  "self-paced-courses-listing-examprep": {
    type: "self-paced-courses-listing-examprep",
    name: "Self-Paced Courses: IIT JEE / NEET",
    description: "Self-paced course listing cards filtered to show only self-paced courses",
    category: "ecommerce",
    icon: "play-circle",
    variants: [
      { id: "default", name: "Default", description: "Three-column self-paced course cards" },
    ],
    defaultContent: {
      headline: "Self-Paced Courses",
      subheadline: "Learn at your own pace with high-quality recorded lectures",
      itemCount: 6,
      seeAllLink: "/all-courses",
    } satisfies ContentListingContent,
  },

  "books-listing-examprep": {
    type: "books-listing-examprep",
    name: "Books: IIT JEE / NEET",
    description: "Study materials listing with book covers, ratings, and pricing",
    category: "ecommerce",
    icon: "book",
    variants: [
      { id: "default", name: "Default", description: "Four-column book cards" },
    ],
    defaultContent: {
      headline: "Recommended Study Materials",
      subheadline: "Essential books and materials curated by experts",
      itemCount: 8,
      seeAllLink: "/all-books",
    } satisfies ContentListingContent,
  },

  // Test Prep (All Govt Exams) Template Sections

  "hero-govtexam": {
    type: "hero-govtexam",
    name: "Hero: Test Prep (All Govt Exams)",
    description: "Hero section with badge, headline, description, CTA, and image",
    category: "hero",
    icon: "graduation-cap",
    variants: [
      { id: "default", name: "Default", description: "Split layout with image" },
    ],
    defaultContent: {
      badge: "India's #1 Government Exam Preparation Platform",
      headline: "Crack",
      headlineAccent: "UPSC, SSC, Bank / All Govt Exams",
      description: "Join 2 Million+ aspirants preparing for government exams with expert guidance, comprehensive study materials, and India's most accurate test series.",
      primaryCta: { text: "Explore Courses", href: "/all-courses", variant: "primary" },
      image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=600&fit=crop",
      imageAlt: "Indian students preparing for government exams with books and laptops",
      stats: [],
    } satisfies HeroExamprepContent,
  },

  "features-govtexam": {
    type: "features-govtexam",
    name: "Features: Test Prep (All Govt Exams)",
    description: "Feature cards grid with icons and descriptions",
    category: "features",
    icon: "grid",
    variants: [
      { id: "default", name: "Default", description: "Six-card grid layout" },
    ],
    defaultContent: {
      headline: "Complete",
      headlineAccent: "Preparation Ecosystem",
      description: "Everything you need to succeed in government exams, all in one platform",
      features: [
        { id: "1", icon: "video", title: "Live / Recorded Classes", description: "Interactive live sessions with India's top educators and unlimited access to recorded lectures" },
        { id: "2", icon: "file-text", title: "AI Resume Builder", description: "Create professional resumes tailored for government job applications with AI-powered suggestions and templates" },
        { id: "3", icon: "mic", title: "AI Mock Interviews", description: "Practice personality tests and interviews with AI-powered feedback and improvement tips" },
        { id: "4", icon: "book-open", title: "Study Materials / Notes", description: "Comprehensive PDFs, current affairs, monthly magazines, and subject-wise notes" },
        { id: "5", icon: "bar-chart", title: "Progress Analytics", description: "Track your preparation with detailed performance reports, weak area analysis, and personalized recommendations" },
        { id: "6", icon: "users", title: "Expert Mentorship", description: "Personal guidance from successful candidates and subject experts throughout your journey" },
      ],
    } satisfies FeaturesExamprepContent,
  },

  "learning-paths-govtexam": {
    type: "learning-paths-govtexam",
    name: "Learning Paths: Test Prep (All Govt Exams)",
    description: "Visual winding roadmap showing the structured learning journey",
    category: "features",
    icon: "route",
    variants: [
      { id: "default", name: "Default", description: "Winding path with waypoint markers" },
    ],
    defaultContent: {
      headline: "Your",
      headlineAccent: "Preparation Journey",
      description: "Structured roadmaps designed by experts to guide you from beginner to exam-ready",
      waypoints: [
        { id: "wp-1", label: "Foundation", icon: "compass" },
        { id: "wp-2", label: "Practice", icon: "book" },
        { id: "wp-3", label: "Mock Tests", icon: "repeat" },
        { id: "wp-4", label: "Revision", icon: "sprout" },
        { id: "wp-5", label: "Exam Ready", icon: "trophy" },
      ],
      goalLabel: "Success",
    } satisfies RoadmapMindfulnessContent,
  },

  "about-govtexam": {
    type: "about-govtexam",
    name: "About: Test Prep (All Govt Exams)",
    description: "About section with image, credentials, and description",
    category: "content",
    icon: "users",
    variants: [
      { id: "default", name: "Default", description: "Image left, content right layout" },
    ],
    defaultContent: {
      badge: "Expert Faculty Team",
      headline: "Learn from",
      headlineAccent: "India's Best Educators",
      description: "Our faculty comprises former civil servants, IAS/IPS officers, and subject matter experts with decades of experience in coaching UPSC, SSC, Banking, and Railway aspirants.",
      image: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&h=600&fit=crop",
      imageAlt: "Experienced faculty mentor guiding students in a modern classroom environment",
      credentials: [
        { id: "1", icon: "check", title: "25+ Years Combined Experience", description: "Our faculty has successfully mentored thousands of government exam aspirants" },
        { id: "2", icon: "check", title: "Personalized Mentorship", description: "One-on-one guidance tailored to your learning pace and goals" },
        { id: "3", icon: "check", title: "Proven Track Record", description: "5000+ selections across UPSC, SSC, Banking, and Railway exams in last 5 years" },
      ],
    } satisfies AboutExamprepContent,
  },

  "testimonials-govtexam": {
    type: "testimonials-govtexam",
    name: "Testimonials: Test Prep (All Govt Exams)",
    description: "Success stories with ratings, quotes, and avatar initials",
    category: "social-proof",
    icon: "message-square",
    variants: [
      { id: "default", name: "Default", description: "Scrolling testimonial cards" },
    ],
    defaultContent: {
      headline: "Success",
      headlineAccent: "Stories",
      description: "Hear from candidates who achieved their government job dreams with us",
      testimonials: [
        { id: "1", name: "Rajesh Kumar", role: "AIR 89, CSE 2023", quote: "The test series and current affairs coverage helped me crack UPSC CSE in my second attempt. The mentorship was phenomenal!", rating: 5, initials: "RK" },
        { id: "2", name: "Priya Sharma", role: "SSC CGL 2023 Selected", quote: "Best platform for SSC preparation. The quality of questions and explanations is top-notch. Highly recommended!", rating: 5, initials: "PS" },
        { id: "3", name: "Amit Mehta", role: "SBI PO 2024", quote: "Cleared SBI PO on first attempt thanks to their banking awareness module and mock tests. The analytics helped identify my weak areas.", rating: 5, initials: "AM" },
      ],
    } satisfies TestimonialsExamprepContent,
  },

  "faq-govtexam": {
    type: "faq-govtexam",
    name: "FAQ: Test Prep (All Govt Exams)",
    description: "Frequently asked questions with accordion layout",
    category: "conversion",
    icon: "help-circle",
    variants: [
      { id: "default", name: "Default", description: "Centered accordion layout" },
    ],
    defaultContent: {
      headline: "Frequently Asked",
      headlineAccent: "Questions",
      description: "Everything you need to know about our platform",
      items: [
        { id: "1", question: "What is included in the course packages?", answer: "All course packages include live classes, recorded lectures, comprehensive study materials, test series, current affairs, doubt clearing sessions, and personalized mentorship. You also get access to our mobile app for offline learning." },
        { id: "2", question: "How accurate are your test series compared to actual exams?", answer: "Our test series are designed by subject experts and previous exam toppers to match the exact pattern, difficulty level, and syllabus of actual government exams. We maintain 95%+ accuracy in question patterns based on latest exam trends." },
        { id: "3", question: "Can I access courses on mobile devices?", answer: "Yes! Our platform works seamlessly on all devices. Download our mobile app (available on Android and iOS) to access all courses, study materials, and tests offline. You can switch between devices without losing progress." },
        { id: "4", question: "Do you provide current affairs for government exams?", answer: "Yes, we provide daily current affairs updates, monthly magazines, weekly quizzes, and yearly compilations. All current affairs content is exam-focused and covers national, international, economy, science, and sports sections." },
        { id: "5", question: "What is your refund policy?", answer: "We offer a 7-day money-back guarantee if you're not satisfied with the course quality. For detailed refund terms and conditions, please refer to our refund policy page or contact our support team." },
        { id: "6", question: "How does the AI mock interview feature work?", answer: "Our AI mock interview system simulates real interview scenarios using voice recognition and natural language processing. It provides instant feedback on your answers, body language tips, and personalized improvement suggestions based on successful candidates' responses." },
      ],
    } satisfies FaqExamprepContent,
  },

  "cta-govtexam": {
    type: "cta-govtexam",
    name: "CTA: Test Prep (All Govt Exams)",
    description: "Gradient call-to-action banner with headline, description, and button",
    category: "conversion",
    icon: "megaphone",
    variants: [
      { id: "default", name: "Default", description: "Full-width gradient CTA" },
    ],
    defaultContent: {
      headline: "Start Your Government Job Journey Today",
      description: "Join 2 million+ aspirants and get access to India's most comprehensive preparation platform for UPSC, SSC, Banking, and Railway exams",
      primaryCta: { text: "Explore Courses", href: "/all-courses", variant: "primary" },
    } satisfies CtaExamprepContent,
  },

  "courses-listing-govtexam": {
    type: "courses-listing-govtexam",
    name: "Courses: Test Prep (All Govt Exams)",
    description: "Course listing cards with images, ratings, pricing, and enrollment",
    category: "ecommerce",
    icon: "book-open",
    variants: [
      { id: "default", name: "Default", description: "Three-column course cards" },
    ],
    defaultContent: {
      headline: "All Courses",
      subheadline: "Expert-led comprehensive programs for government exam success",
      itemCount: 6,
      seeAllLink: "/all-courses",
    } satisfies ContentListingContent,
  },

  "self-paced-courses-listing-govtexam": {
    type: "self-paced-courses-listing-govtexam",
    name: "Self-Paced Courses: Test Prep (All Govt Exams)",
    description: "Self-paced course listing cards filtered to show only self-paced courses",
    category: "ecommerce",
    icon: "play-circle",
    variants: [
      { id: "default", name: "Default", description: "Three-column self-paced course cards" },
    ],
    defaultContent: {
      headline: "Self-Paced Courses",
      subheadline: "Learn at your own pace with high-quality recorded lectures",
      itemCount: 6,
      seeAllLink: "/all-courses",
    } satisfies ContentListingContent,
  },

  "books-listing-govtexam": {
    type: "books-listing-govtexam",
    name: "Books: Test Prep (All Govt Exams)",
    description: "Study materials listing with book covers, ratings, and pricing",
    category: "ecommerce",
    icon: "book",
    variants: [
      { id: "default", name: "Default", description: "Four-column book cards" },
    ],
    defaultContent: {
      headline: "Comprehensive Study Materials",
      subheadline: "Curated books and notes by top educators for complete preparation",
      itemCount: 8,
      seeAllLink: "/all-books",
    } satisfies ContentListingContent,
  },

  "exam-categories-govtexam": {
    type: "exam-categories-govtexam",
    name: "Exam Categories: Test Prep (All Govt Exams)",
    description: "Exam category cards grid with icons, titles, and descriptions",
    category: "features",
    icon: "layout-grid",
    variants: [
      { id: "default", name: "Default", description: "Four-column category cards" },
    ],
    defaultContent: {
      headline: "Prepare for",
      headlineAccent: "Top Government Exams",
      description: "Comprehensive courses for all major competitive examinations",
      categories: [
        { id: "1", icon: "landmark", title: "UPSC CSE", description: "Civil Services, IAS, IPS, IFS preparation" },
        { id: "2", icon: "file-text", title: "SSC CGL", description: "Combined Graduate Level examination" },
        { id: "3", icon: "building", title: "Bank PO/Clerk", description: "SBI, IBPS, RBI banking exams" },
        { id: "4", icon: "train-front", title: "RRB NTPC", description: "Railway recruitment board exams" },
      ],
    } satisfies ExamCategoriesGovtexamContent,
  },

  "trusted-by-govtexam": {
    type: "trusted-by-govtexam",
    name: "Trusted By: Test Prep (All Govt Exams)",
    description: "Dark-background scrolling marquee of trusted institutions and brands",
    category: "social-proof",
    icon: "award",
    variants: [
      { id: "default", name: "Default", description: "Infinite scrolling logo marquee" },
    ],
    defaultContent: {
      label: "Trusted by aspirants from top institutions across India",
      items: [
        { id: "1", icon: "landmark", name: "DU" },
        { id: "2", icon: "graduation-cap", name: "JNU" },
        { id: "3", icon: "newspaper", name: "The Hindu" },
        { id: "4", icon: "building", name: "IGNOU" },
        { id: "5", icon: "book-open", name: "Vajiram" },
        { id: "6", icon: "library", name: "AMU" },
        { id: "7", icon: "school", name: "BHU" },
        { id: "8", icon: "award", name: "Shankar IAS" },
      ],
    } satisfies TrustedByGovtexamContent,
  },

  // ── Corporate Upskilling Template ──

  "hero-corpupskill": {
    type: "hero-corpupskill",
    name: "Hero: Corporate Upskilling",
    description: "Full-width hero with image, badge, headline, description, and CTA",
    category: "hero",
    icon: "layout",
    variants: [{ id: "default", name: "Default", description: "Image hero with overlay text" }],
    defaultContent: {
      slides: [
        {
          id: "s1",
          image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&h=900&fit=crop",
          imageAlt: "Corporate training session",
          badge: "Continuous Learning",
          headlineLine1: "Upskill Your",
          headlineAccent: "Workforce",
          headlineLine3: "At Scale",
          subtitle: "Stay Ahead of Industry Trends",
          description: "Transform teams with cutting-edge skills. Close knowledge gaps. Build expertise that drives business growth.",
          cornerBadge: "UPSKILLING HUB",
        },
        {
          id: "s2",
          image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=900&fit=crop",
          imageAlt: "Team collaboration",
          badge: "Skill Development",
          headlineLine1: "Become An",
          headlineAccent: "Industry",
          headlineLine3: "Expert",
          subtitle: "Master In-Demand Skills",
          description: "Accelerate career growth. Build deep expertise. Lead with confidence in your domain.",
          cornerBadge: "EXPERT PATH",
        },
        {
          id: "s3",
          image: "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&h=900&fit=crop",
          imageAlt: "Expert trainer",
          badge: "Stay Updated",
          headlineLine1: "Stay Ahead",
          headlineAccent: "Of Change",
          headlineLine3: "Always",
          subtitle: "Latest Industry Knowledge",
          description: "Keep pace with innovation. Learn emerging technologies. Future-proof your team's capabilities.",
          cornerBadge: "STAY CURRENT",
        },
      ],
      primaryCta: { text: "Explore Courses", href: "/all-courses", variant: "primary" },
    } satisfies HeroSliderCorpupskillContent,
  },

  "trusted-by-corpupskill": {
    type: "trusted-by-corpupskill",
    name: "Trusted By: Corporate Upskilling",
    description: "Dark bar with company brand marks (label left, logos right)",
    category: "social-proof",
    icon: "award",
    variants: [{ id: "default", name: "Default", description: "Static logo row" }],
    defaultContent: {
      label: "Employees from Top Companies Learning Here",
      items: [
        { id: "1", icon: "brand-microsoft", name: "Microsoft" },
        { id: "2", icon: "brand-aws", name: "AWS" },
        { id: "3", icon: "brand-google", name: "Google" },
        { id: "4", icon: "brand-slack", name: "Slack" },
        { id: "5", icon: "brand-salesforce", name: "Salesforce" },
      ],
    } satisfies TrustedByGovtexamContent,
  },

  "features-split-corpupskill": {
    type: "features-split-corpupskill",
    name: "Features Split: Corporate Upskilling",
    description: "Two-column split layout with icons, headlines, and checklists",
    category: "features",
    icon: "columns",
    variants: [{ id: "default", name: "Default", description: "Side-by-side feature columns" }],
    defaultContent: {
      columns: [
        {
          icon: "trending-up",
          headline: "Accelerate Your Career",
          description: "Build in-demand skills. Earn recognized certifications. Get promoted faster.",
          checkItems: [
            { id: "1", title: "Personalized Learning Paths", description: "AI-powered recommendations based on your role and goals" },
            { id: "2", title: "Industry-Recognized Certificates", description: "Boost your resume with credentials employers value" },
            { id: "3", title: "Flexible Learning Schedule", description: "Learn at your own pace, anytime, anywhere" },
          ],
          linkText: "Explore Career Paths",
          linkHref: "/all-courses",
        },
        {
          icon: "graduation-cap",
          headline: "Master New Skills",
          description: "Stay competitive. Learn from experts. Transform your capabilities.",
          checkItems: [
            { id: "4", title: "Expert-Led Training", description: "Learn from industry leaders and practitioners" },
            { id: "5", title: "Hands-On Projects", description: "Apply knowledge through real-world scenarios" },
            { id: "6", title: "Progress Tracking", description: "Monitor your growth and celebrate achievements" },
          ],
          linkText: "Browse All Courses",
          linkHref: "/all-courses",
        },
      ],
    } satisfies FeaturesSplitCorpupskillContent,
  },

  "analytics-corpupskill": {
    type: "analytics-corpupskill",
    name: "Analytics: Corporate Upskilling",
    description: "Dark section with skill progress bar chart and highlight list",
    category: "features",
    icon: "bar-chart",
    variants: [{ id: "default", name: "Default", description: "Chart and highlights layout" }],
    defaultContent: {
      badge: "Your Progress",
      headline: "Track Your Learning Journey",
      description: "Visualize your growth. Celebrate milestones. Stay motivated with data-driven insights.",
      chartCardSubtitle: "Current Progress - Q4 2024",
      chartBars: [
        { id: "cb1", label: "Cloud Computing", value: 92 },
        { id: "cb2", label: "Leadership", value: 78 },
        { id: "cb3", label: "Data Analytics", value: 85 },
        { id: "cb4", label: "Cybersecurity", value: 88 },
        { id: "cb5", label: "Project Mgmt", value: 76 },
      ],
      highlights: [
        { id: "1", icon: "trophy", title: "Achievement Badges", description: "Earn recognition for completing courses and mastering skills" },
        { id: "2", icon: "target", title: "Skill Benchmarking", description: "See how your skills compare to industry standards" },
      ],
    } satisfies AnalyticsCorpupskillContent,
  },

  "solutions-grid-corpupskill": {
    type: "solutions-grid-corpupskill",
    name: "Solutions Grid: Corporate Upskilling",
    description: "Masonry grid of course category cards with images and ratings",
    category: "content",
    icon: "layout-grid",
    variants: [{ id: "default", name: "Default", description: "Masonry card grid" }],
    defaultContent: {
      badge: "Learning Library",
      headline: "10,000+ Expert-Led Programs Ready to Deploy",
      description: "From leadership to technical skills. Compliance to soft skills. All vetted. All enterprise-ready.",
      cards: [
        { id: "1", image: "/templates/corpupskill/leadership.webp", badge: "Leadership", title: "Executive Leadership Mastery", description: "Transform managers into visionary leaders", rating: "4.9", ratingCount: "120", duration: "12 Hours" },
        { id: "2", image: "/templates/corpupskill/cloud-architecture.webp", badge: "Technical", title: "Cloud Architecture", rating: "4.8" },
        { id: "3", image: "/templates/corpupskill/data-privacy.webp", badge: "Compliance", title: "Data Privacy 2024", rating: "4.7" },
        { id: "4", image: "/templates/corpupskill/team-communication.webp", badge: "Soft Skills", title: "Team Communication", rating: "4.9" },
        { id: "5", image: "/templates/corpupskill/digital-transformation.webp", badge: "Innovation", title: "Digital Transformation", rating: "4.8" },
      ],
    } satisfies SolutionsGridCorpupskillContent,
  },

  "self-paced-courses-listing-corpupskill": {
    type: "self-paced-courses-listing-corpupskill",
    name: "Self-Paced Courses: Corporate Upskilling",
    description: "Self-paced course listing cards",
    category: "ecommerce",
    icon: "play-circle",
    variants: [{ id: "default", name: "Default", description: "Course cards grid" }],
    defaultContent: {
      headline: "Self-Paced Courses",
      subheadline: "Learn at your own pace with high-quality recorded lectures",
      itemCount: 6,
      seeAllLink: "/all-courses",
    } satisfies ContentListingContent,
  },

  "books-listing-corpupskill": {
    type: "books-listing-corpupskill",
    name: "Books: Corporate Upskilling",
    description: "Books and study materials listing",
    category: "ecommerce",
    icon: "book",
    variants: [{ id: "default", name: "Default", description: "Book cards grid" }],
    defaultContent: {
      headline: "Recommended Books & Materials",
      subheadline: "Essential books and resources curated for professional development",
      itemCount: 8,
      seeAllLink: "/all-books",
    } satisfies ContentListingContent,
  },

  "testimonials-corpupskill": {
    type: "testimonials-corpupskill",
    name: "Testimonials: Corporate Upskilling",
    description: "Horizontal scrolling employee success stories",
    category: "social-proof",
    icon: "message-square",
    variants: [{ id: "default", name: "Default", description: "Scrolling testimonial cards" }],
    defaultContent: {
      badge: "Success Stories",
      headline: "Real Career Growth",
      description: "Hear how teams and individuals grew skills, earned promotions, and shipped bigger outcomes.",
      testimonials: [
        {
          id: "1",
          name: "David Chen",
          role: "Software Engineer to Team Lead",
          quote:
            "Completed cloud architecture certification and got promoted within 6 months. The hands-on projects made all the difference.",
          metricValue: "6mo",
          metricLabel: "To Promotion",
          rating: 5,
          initials: "DC",
        },
        {
          id: "2",
          name: "Sarah Martinez",
          role: "Marketing Analyst to Manager",
          quote:
            "The data analytics courses transformed how I approach campaigns. My confidence and salary both increased significantly.",
          metricValue: "35%",
          metricLabel: "Salary Increase",
          rating: 5,
          initials: "SM",
        },
        {
          id: "3",
          name: "Marcus Thompson",
          role: "Junior to Senior Developer",
          quote:
            "Learning advanced JavaScript and system design helped me level up. Now I'm mentoring others on my team.",
          metricValue: "2",
          metricLabel: "Levels Up",
          rating: 5,
          initials: "MT",
        },
      ],
    } satisfies TestimonialsCorpupskillContent,
  },

  "cta-corpupskill": {
    type: "cta-corpupskill",
    name: "CTA: Corporate Upskilling",
    description: "CTA with full-bleed background image, headline, and trust badges",
    category: "conversion",
    icon: "megaphone",
    variants: [{ id: "default", name: "Default", description: "Background image + dark overlay CTA" }],
    defaultContent: {
      headline: "Ready to Upskill?",
      description: "Start learning today. Unlock your potential. Advance your career.",
      backgroundImage:
        "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1920&h=1080&fit=crop&q=80",
      backgroundImageAlt: "Team collaborating on professional skill development and training",
      primaryCta: { text: "Explore Courses", href: "/all-courses", variant: "primary" },
      trustBadges: [
        { id: "1", icon: "award", text: "Earn Certificates" },
        { id: "2", icon: "clock", text: "Learn Anytime" },
        { id: "3", icon: "rocket", text: "Start Free Today" },
      ],
    } satisfies CtaCorpupskillContent,
  },
};

/**
 * Get section registry entry by type.
 * Returns undefined for "header" and "footer" (use layout header/footer instead).
 */
export function getSectionRegistry(type: SectionType): SectionRegistryEntry | undefined {
  if (type === "header" || type === "footer") return undefined;
  return sectionRegistry[type];
}

/**
 * Get default content for a section type.
 * Throws for "header" and "footer" (use layout header/footer instead).
 */
export function getDefaultContent<T>(type: SectionType): T {
  if (type === "header" || type === "footer") {
    throw new Error(
      'Section type "header" and "footer" are deprecated. Use layout header/footer instead.'
    );
  }
  const entry = sectionRegistry[type];
  if (!entry) {
    // Section type not yet registered, return empty object as fallback
    return {} as T;
  }
  return entry.defaultContent as T;
}

/**
 * Get all section types
 */
export function getAllSectionTypes(): SectionType[] {
  return Object.keys(sectionRegistry) as SectionType[];
}
