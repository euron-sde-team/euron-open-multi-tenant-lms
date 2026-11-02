import type { ProductCategory } from "../types/product-categories";

/**
 * Comprehensive list of digital product categories sold in India and worldwide.
 * Each category has sub-categories and maps to a unique landing page template.
 */
export const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    id: "exam-preparation",
    name: "Exam Preparation",
    description:
      "Competitive exam coaching for JEE, NEET, UPSC, CAT, GATE, GRE, SAT and more",
    icon: "GraduationCap",
    color: "bg-blue-500",
    subCategories: [
      {
        id: "engineering-entrance",
        name: "Engineering Entrance",
        description: "JEE Main, JEE Advanced, BITSAT, VITEEE preparation",
        icon: "Cpu",
      },
      {
        id: "medical-entrance",
        name: "Medical Entrance",
        description: "NEET UG, NEET PG, AIIMS preparation",
        icon: "Stethoscope",
      },
      {
        id: "civil-services",
        name: "Civil Services",
        description: "UPSC CSE, State PSC, SSC preparation",
        icon: "Landmark",
      },
      {
        id: "mba-entrance",
        name: "MBA Entrance",
        description: "CAT, XAT, GMAT, MAT preparation",
        icon: "Briefcase",
      },
      {
        id: "study-abroad",
        name: "Study Abroad",
        description: "GRE, SAT, ACT, GMAT preparation",
        icon: "Plane",
      },
    ],
  },
  {
    id: "programming-development",
    name: "Programming & Development",
    description:
      "Web development, mobile apps, DSA, system design and software engineering",
    icon: "Code",
    color: "bg-indigo-500",
    subCategories: [
      {
        id: "web-development",
        name: "Web Development",
        description: "HTML, CSS, JavaScript, React, Next.js, Node.js",
        icon: "Globe",
      },
      {
        id: "mobile-development",
        name: "Mobile Development",
        description: "React Native, Flutter, Swift, Kotlin",
        icon: "Smartphone",
      },
      {
        id: "dsa",
        name: "Data Structures & Algorithms",
        description: "Problem solving, competitive programming, interview prep",
        icon: "Binary",
      },
      {
        id: "devops",
        name: "DevOps",
        description: "Docker, Kubernetes, CI/CD, AWS, cloud infrastructure",
        icon: "Container",
      },
      {
        id: "system-design",
        name: "System Design",
        description: "Scalable architectures, distributed systems, HLD/LLD",
        icon: "Network",
      },
    ],
  },
  {
    id: "data-science-ai",
    name: "Data Science & AI",
    description:
      "Machine learning, deep learning, data analytics, NLP and artificial intelligence",
    icon: "Brain",
    color: "bg-purple-500",
    subCategories: [
      {
        id: "machine-learning",
        name: "Machine Learning",
        description: "Supervised, unsupervised, reinforcement learning",
        icon: "Sparkles",
      },
      {
        id: "data-analytics",
        name: "Data Analytics",
        description: "Python, R, SQL, Tableau, Power BI, Excel",
        icon: "BarChart3",
      },
      {
        id: "artificial-intelligence",
        name: "Artificial Intelligence",
        description: "Deep learning, neural networks, GenAI, LLMs",
        icon: "Bot",
      },
      {
        id: "nlp",
        name: "NLP",
        description: "Natural language processing, text mining, chatbots",
        icon: "MessageSquare",
      },
      {
        id: "computer-vision",
        name: "Computer Vision",
        description: "Image recognition, object detection, OpenCV",
        icon: "Eye",
      },
    ],
  },
  {
    id: "business-entrepreneurship",
    name: "Business & Entrepreneurship",
    description:
      "Startup building, digital marketing, sales, strategy and e-commerce",
    icon: "Rocket",
    color: "bg-orange-500",
    subCategories: [
      {
        id: "digital-marketing",
        name: "Digital Marketing",
        description: "SEO, social media, Google Ads, content marketing",
        icon: "Megaphone",
      },
      {
        id: "startup-building",
        name: "Startup Building",
        description: "Ideation, MVP, fundraising, scaling",
        icon: "Rocket",
      },
      {
        id: "business-strategy",
        name: "Business Strategy",
        description: "Market analysis, competitive strategy, growth hacking",
        icon: "Target",
      },
      {
        id: "sales",
        name: "Sales",
        description: "B2B sales, negotiation, CRM, lead generation",
        icon: "Handshake",
      },
      {
        id: "ecommerce",
        name: "E-commerce",
        description: "Shopify, Amazon FBA, dropshipping, D2C",
        icon: "ShoppingCart",
      },
    ],
  },
  {
    id: "design-creative",
    name: "Design & Creative",
    description:
      "UI/UX design, graphic design, video editing, photography and animation",
    icon: "Palette",
    color: "bg-pink-500",
    subCategories: [
      {
        id: "ui-ux-design",
        name: "UI/UX Design",
        description: "Figma, user research, wireframing, prototyping",
        icon: "Layout",
      },
      {
        id: "graphic-design",
        name: "Graphic Design",
        description: "Photoshop, Illustrator, Canva, branding",
        icon: "PenTool",
      },
      {
        id: "video-production",
        name: "Video Production",
        description: "Premiere Pro, After Effects, DaVinci Resolve",
        icon: "Video",
      },
      {
        id: "photography",
        name: "Photography",
        description: "Lightroom, portrait, product, landscape photography",
        icon: "Camera",
      },
      {
        id: "animation",
        name: "Animation",
        description: "2D/3D animation, motion graphics, Blender",
        icon: "Clapperboard",
      },
    ],
  },
  {
    id: "health-fitness",
    name: "Health & Fitness",
    description:
      "Gym training, yoga, nutrition planning, sports coaching and mental wellness",
    icon: "Dumbbell",
    color: "bg-green-500",
    subCategories: [
      {
        id: "gym-strength",
        name: "Gym & Strength Training",
        description: "Weightlifting, bodybuilding, powerlifting, CrossFit",
        icon: "Dumbbell",
      },
      {
        id: "yoga-meditation",
        name: "Yoga & Meditation",
        description: "Hatha yoga, Vinyasa, pranayama, mindfulness",
        icon: "Flower2",
      },
      {
        id: "nutrition-diet",
        name: "Nutrition & Diet",
        description: "Meal planning, macros, weight loss, sports nutrition",
        icon: "Apple",
      },
      {
        id: "sports-training",
        name: "Sports Training",
        description: "Cricket, football, basketball, athletics coaching",
        icon: "Trophy",
      },
      {
        id: "mental-wellness",
        name: "Mental Wellness",
        description: "Stress management, sleep, therapy techniques",
        icon: "Heart",
      },
    ],
  },
  {
    id: "personal-development",
    name: "Personal Development",
    description:
      "Communication skills, leadership, productivity, public speaking and emotional intelligence",
    icon: "UserCheck",
    color: "bg-teal-500",
    subCategories: [
      {
        id: "communication-skills",
        name: "Communication Skills",
        description: "Verbal, written, interpersonal communication",
        icon: "MessageCircle",
      },
      {
        id: "leadership",
        name: "Leadership",
        description: "Team management, decision making, executive presence",
        icon: "Crown",
      },
      {
        id: "time-management",
        name: "Time Management",
        description: "Productivity systems, GTD, focus techniques",
        icon: "Clock",
      },
      {
        id: "public-speaking",
        name: "Public Speaking",
        description: "Presentations, storytelling, stage confidence",
        icon: "Mic",
      },
      {
        id: "emotional-intelligence",
        name: "Emotional Intelligence",
        description: "Self-awareness, empathy, social skills",
        icon: "HeartHandshake",
      },
    ],
  },
  {
    id: "finance-investing",
    name: "Finance & Investing",
    description:
      "Stock market, cryptocurrency, personal finance, tax planning and real estate",
    icon: "TrendingUp",
    color: "bg-emerald-500",
    subCategories: [
      {
        id: "stock-market",
        name: "Stock Market",
        description: "Equity trading, technical analysis, mutual funds",
        icon: "CandlestickChart",
      },
      {
        id: "cryptocurrency",
        name: "Cryptocurrency",
        description: "Bitcoin, Ethereum, DeFi, blockchain technology",
        icon: "Bitcoin",
      },
      {
        id: "personal-finance",
        name: "Personal Finance",
        description: "Budgeting, saving, insurance, retirement planning",
        icon: "Wallet",
      },
      {
        id: "tax-accounting",
        name: "Tax & Accounting",
        description: "Income tax, GST, bookkeeping, financial statements",
        icon: "Calculator",
      },
      {
        id: "real-estate",
        name: "Real Estate",
        description: "Property investment, REITs, rental income",
        icon: "Building2",
      },
    ],
  },
  {
    id: "language-learning",
    name: "Language Learning",
    description:
      "English speaking, foreign languages, IELTS/TOEFL prep, regional and sign language",
    icon: "Languages",
    color: "bg-cyan-500",
    subCategories: [
      {
        id: "english-speaking",
        name: "English Speaking",
        description: "Spoken English, grammar, vocabulary, fluency",
        icon: "MessageSquare",
      },
      {
        id: "foreign-languages",
        name: "Foreign Languages",
        description: "Spanish, French, German, Japanese, Korean, Mandarin",
        icon: "Globe",
      },
      {
        id: "ielts-toefl",
        name: "IELTS / TOEFL",
        description: "Test preparation, mock tests, band improvement",
        icon: "FileCheck",
      },
      {
        id: "regional-languages",
        name: "Regional Languages",
        description: "Hindi, Tamil, Telugu, Bengali, Marathi and more",
        icon: "BookOpen",
      },
      {
        id: "sign-language",
        name: "Sign Language",
        description: "ASL, BSL, ISL basics and advanced communication",
        icon: "Hand",
      },
    ],
  },
  {
    id: "school-academic",
    name: "School & Academic",
    description:
      "K-12 education, CBSE, ICSE, state board syllabus and olympiad preparation",
    icon: "School",
    color: "bg-amber-500",
    subCategories: [
      {
        id: "class-1-5",
        name: "Class 1-5",
        description: "Foundation learning, basic maths, science, English",
        icon: "Baby",
      },
      {
        id: "class-6-10",
        name: "Class 6-10",
        description: "Middle school maths, science, social studies",
        icon: "BookOpen",
      },
      {
        id: "class-11-12",
        name: "Class 11-12",
        description: "PCM, PCB, Commerce, Arts stream subjects",
        icon: "GraduationCap",
      },
      {
        id: "board-exams",
        name: "CBSE / ICSE / State Board",
        description: "Board exam preparation, sample papers, revision",
        icon: "ClipboardList",
      },
      {
        id: "olympiad-prep",
        name: "Olympiad Prep",
        description: "Maths, science, cyber olympiad coaching",
        icon: "Medal",
      },
    ],
  },
  {
    id: "music-arts",
    name: "Music & Arts",
    description:
      "Musical instruments, vocal training, dance, drawing and crafts",
    icon: "Music",
    color: "bg-rose-500",
    subCategories: [
      {
        id: "musical-instruments",
        name: "Musical Instruments",
        description: "Guitar, piano, drums, violin, flute, tabla",
        icon: "Guitar",
      },
      {
        id: "vocal-training",
        name: "Vocal Training",
        description: "Singing, voice modulation, classical and western vocals",
        icon: "Mic2",
      },
      {
        id: "dance",
        name: "Dance",
        description: "Classical, contemporary, hip-hop, Bollywood, salsa",
        icon: "Music2",
      },
      {
        id: "drawing-painting",
        name: "Drawing & Painting",
        description: "Sketching, watercolor, oil painting, digital art",
        icon: "Paintbrush",
      },
      {
        id: "crafts-diy",
        name: "Crafts & DIY",
        description: "Pottery, knitting, woodworking, paper crafts",
        icon: "Scissors",
      },
    ],
  },
  {
    id: "digital-products-ebooks",
    name: "Digital Products & eBooks",
    description:
      "eBooks, Notion templates, printables, stock assets and software tools",
    icon: "BookMarked",
    color: "bg-violet-500",
    subCategories: [
      {
        id: "ebooks",
        name: "eBooks",
        description: "Fiction, non-fiction, guides, reference books",
        icon: "BookOpen",
      },
      {
        id: "notion-templates",
        name: "Notion Templates",
        description: "Productivity, project management, habit trackers",
        icon: "LayoutTemplate",
      },
      {
        id: "printables",
        name: "Printables",
        description: "Planners, worksheets, wall art, invitations",
        icon: "Printer",
      },
      {
        id: "stock-assets",
        name: "Stock Assets",
        description: "Photos, illustrations, icons, fonts, mockups",
        icon: "Image",
      },
      {
        id: "software-tools",
        name: "Software Tools",
        description: "SaaS products, plugins, Chrome extensions, APIs",
        icon: "Package",
      },
    ],
  },
];

/**
 * Get a product category by its ID
 */
export const getProductCategoryById = (
  id: string
): ProductCategory | undefined =>
  PRODUCT_CATEGORIES.find((c) => c.id === id);

/**
 * Get all product categories
 */
export const getAllProductCategories = (): ProductCategory[] =>
  PRODUCT_CATEGORIES;

/**
 * Get sub-categories for a given category ID
 */
export const getSubCategories = (categoryId: string) => {
  const category = getProductCategoryById(categoryId);
  return category?.subCategories ?? [];
};
