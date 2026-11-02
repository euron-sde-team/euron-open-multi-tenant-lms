/**
 * Curated catalogue of common formulas for the equation dialog.
 * Each entry has a human-readable name and the LaTeX it inserts. Authors who
 * don't remember the LaTeX for "quadratic formula" or "law of cosines" can
 * pick one from this list and edit visually in MathLive afterwards.
 */
export interface FormulaPreset {
  name: string;
  latex: string;
}

export interface FormulaCategory {
  name: string;
  formulas: FormulaPreset[];
}

export const FORMULA_LIBRARY: FormulaCategory[] = [
  {
    name: "Algebra",
    formulas: [
      { name: "Quadratic formula", latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}" },
      { name: "Difference of squares", latex: "a^2 - b^2 = (a + b)(a - b)" },
      { name: "Binomial expansion", latex: "(a + b)^2 = a^2 + 2ab + b^2" },
      { name: "Cube of sum", latex: "(a + b)^3 = a^3 + 3a^2 b + 3a b^2 + b^3" },
      { name: "Sum of n terms (AP)", latex: "S_n = \\frac{n}{2}(2a + (n - 1)d)" },
      { name: "Sum of n terms (GP)", latex: "S_n = a \\frac{1 - r^n}{1 - r}" },
      { name: "Logarithm change of base", latex: "\\log_b a = \\frac{\\log a}{\\log b}" },
    ],
  },
  {
    name: "Geometry",
    formulas: [
      { name: "Area of circle", latex: "A = \\pi r^2" },
      { name: "Circumference", latex: "C = 2 \\pi r" },
      { name: "Area of triangle", latex: "A = \\tfrac{1}{2} b h" },
      { name: "Pythagorean theorem", latex: "a^2 + b^2 = c^2" },
      { name: "Volume of sphere", latex: "V = \\tfrac{4}{3} \\pi r^3" },
      { name: "Volume of cylinder", latex: "V = \\pi r^2 h" },
      { name: "Distance between points", latex: "d = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}" },
    ],
  },
  {
    name: "Trigonometry",
    formulas: [
      { name: "Pythagorean identity", latex: "\\sin^2 \\theta + \\cos^2 \\theta = 1" },
      { name: "Sine of double angle", latex: "\\sin 2\\theta = 2 \\sin \\theta \\cos \\theta" },
      { name: "Cosine of double angle", latex: "\\cos 2\\theta = \\cos^2 \\theta - \\sin^2 \\theta" },
      { name: "Law of sines", latex: "\\frac{a}{\\sin A} = \\frac{b}{\\sin B} = \\frac{c}{\\sin C}" },
      { name: "Law of cosines", latex: "c^2 = a^2 + b^2 - 2 a b \\cos C" },
      { name: "Tan of sum", latex: "\\tan(\\alpha + \\beta) = \\frac{\\tan \\alpha + \\tan \\beta}{1 - \\tan \\alpha \\tan \\beta}" },
    ],
  },
  {
    name: "Calculus",
    formulas: [
      { name: "Derivative definition", latex: "f'(x) = \\lim_{h \\to 0} \\frac{f(x + h) - f(x)}{h}" },
      { name: "Power rule", latex: "\\frac{d}{dx} x^n = n x^{n-1}" },
      { name: "Product rule", latex: "(f g)' = f' g + f g'" },
      { name: "Quotient rule", latex: "\\left( \\tfrac{f}{g} \\right)' = \\frac{f' g - f g'}{g^2}" },
      { name: "Chain rule", latex: "\\frac{d}{dx} f(g(x)) = f'(g(x)) \\, g'(x)" },
      { name: "Fundamental theorem", latex: "\\int_a^b f'(x) \\, dx = f(b) - f(a)" },
      { name: "Integration by parts", latex: "\\int u \\, dv = u v - \\int v \\, du" },
      { name: "Taylor series", latex: "f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!} (x - a)^n" },
    ],
  },
  {
    name: "Statistics",
    formulas: [
      { name: "Mean", latex: "\\bar{x} = \\frac{1}{n} \\sum_{i=1}^{n} x_i" },
      { name: "Variance", latex: "\\sigma^2 = \\frac{1}{n} \\sum_{i=1}^{n} (x_i - \\bar{x})^2" },
      { name: "Standard deviation", latex: "\\sigma = \\sqrt{\\frac{1}{n} \\sum (x_i - \\bar{x})^2}" },
      { name: "Z-score", latex: "z = \\frac{x - \\mu}{\\sigma}" },
      { name: "Normal distribution PDF", latex: "f(x) = \\frac{1}{\\sigma \\sqrt{2 \\pi}} e^{-\\tfrac{(x - \\mu)^2}{2 \\sigma^2}}" },
      { name: "Combinations", latex: "\\binom{n}{r} = \\frac{n!}{r!(n - r)!}" },
      { name: "Permutations", latex: "P(n, r) = \\frac{n!}{(n - r)!}" },
    ],
  },
  {
    name: "Physics",
    formulas: [
      { name: "Newton's second law", latex: "F = m a" },
      { name: "Kinetic energy", latex: "E_k = \\tfrac{1}{2} m v^2" },
      { name: "Potential energy", latex: "E_p = m g h" },
      { name: "Mass-energy equivalence", latex: "E = m c^2" },
      { name: "Coulomb's law", latex: "F = k_e \\frac{q_1 q_2}{r^2}" },
      { name: "Ohm's law", latex: "V = I R" },
      { name: "Universal gravitation", latex: "F = G \\frac{m_1 m_2}{r^2}" },
      { name: "Snell's law", latex: "n_1 \\sin \\theta_1 = n_2 \\sin \\theta_2" },
      { name: "Wave equation", latex: "v = f \\lambda" },
      { name: "Schrödinger (time-indep.)", latex: "\\hat{H} \\psi = E \\psi" },
    ],
  },
  {
    name: "Chemistry",
    formulas: [
      { name: "Ideal gas law", latex: "P V = n R T" },
      { name: "pH", latex: "\\text{pH} = -\\log[\\text{H}^+]" },
      { name: "Henderson–Hasselbalch", latex: "\\text{pH} = \\text{pK}_a + \\log \\frac{[A^-]}{[HA]}" },
      { name: "Rate law", latex: "\\text{rate} = k [A]^m [B]^n" },
      { name: "Arrhenius equation", latex: "k = A e^{-\\frac{E_a}{R T}}" },
    ],
  },
];
