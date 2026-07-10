import type { FormSchema } from "@formbuilder/form-schema";

export type Tone = "violet" | "green" | "amber" | "blue" | "red";

export type Template = {
  id: string;
  name: string;
  category: string;
  description: string;
  tone: Tone;
  rating: number;
  uses: string;
  featured?: boolean;
  schema: FormSchema;
};

/** Category chips, in the order the mockup shows them. */
export const CATEGORIES = [
  "All",
  "Lead generation",
  "Survey",
  "Feedback",
  "Registration",
  "Quiz",
  "Application",
  "Payment",
  "HR",
  "Education",
  "Community",
  "Product",
] as const;

/** Gradient + accent used for a template's cover + preview, keyed by tone. */
export const TONE: Record<Tone, { from: string; line: string; accent: string }> = {
  violet: { from: "#F0EEFE", line: "#E4E0FC", accent: "#6D5EFA" },
  green: { from: "#E7F6ED", line: "#CDEAD8", accent: "#159C56" },
  amber: { from: "#FBF0D9", line: "#F1E1BC", accent: "#C4790B" },
  blue: { from: "#E8F0FE", line: "#D2E2FC", accent: "#2F6BE4" },
  red: { from: "#FCECEC", line: "#F6D5D5", accent: "#DC4B47" },
};

export const TEMPLATES: Template[] = [
  {
    id: "nps",
    name: "Customer Feedback & NPS Survey",
    category: "Feedback",
    description:
      "Measure satisfaction with an NPS scale, a follow-up question, and a thank-you screen — used by 14,200 teams to turn feedback into action.",
    tone: "violet",
    rating: 4.9,
    uses: "14.2k",
    featured: true,
    schema: {
      title: "How are we doing?",
      description: "Two quick questions — thank you!",
      settings: { theme: { accent: "#6D5EFA", radius: "md" } },
      blocks: [
        {
          id: "nps",
          type: "scale",
          label: "How likely are you to recommend us?",
          required: true,
          min: 0,
          max: 10,
        },
        { id: "why", type: "long", label: "What could we improve?", required: false },
      ],
    },
  },
  {
    id: "lead-capture",
    name: "Lead Capture Form",
    category: "Lead generation",
    description: "Turn visitors into leads with a clean name, work email, and company field.",
    tone: "violet",
    rating: 4.9,
    uses: "18.4k",
    schema: {
      title: "Get in touch",
      description: "We'll reach out within one business day.",
      settings: { theme: { accent: "#6D5EFA", radius: "md" } },
      blocks: [
        { id: "name", type: "short", label: "Full name", required: true },
        { id: "email", type: "email", label: "Work email", required: true },
        { id: "company", type: "short", label: "Company", required: false },
      ],
    },
  },
  {
    id: "product-feedback",
    name: "Product Feedback",
    category: "Feedback",
    description: "Capture a star rating and open comments to guide your roadmap.",
    tone: "green",
    rating: 4.8,
    uses: "12.1k",
    schema: {
      title: "Product feedback",
      description: "Help us build the right things.",
      settings: { theme: { accent: "#159C56", radius: "md" } },
      blocks: [
        { id: "rating", type: "rating", label: "How was your experience?", required: true },
        { id: "liked", type: "long", label: "What did you like most?", required: false },
        {
          id: "recommend",
          type: "choice",
          label: "Would you recommend us?",
          required: true,
          options: ["Definitely", "Maybe", "Not yet"],
        },
      ],
    },
  },
  {
    id: "event-registration",
    name: "Event Registration",
    category: "Registration",
    description: "Collect attendance, guest counts, and dietary needs for your event.",
    tone: "amber",
    rating: 4.7,
    uses: "9.8k",
    schema: {
      title: "You're invited 🎉",
      description: "Please register by Friday.",
      settings: { theme: { accent: "#E1663E", radius: "lg" } },
      blocks: [
        { id: "name", type: "short", label: "Your name", required: true },
        { id: "email", type: "email", label: "Email", required: true },
        { id: "date", type: "date", label: "Which date works for you?", required: true },
        { id: "guests", type: "number", label: "How many guests?", required: false },
        {
          id: "diet",
          type: "checkbox",
          label: "Dietary preferences",
          required: false,
          options: ["Vegetarian", "Vegan", "Gluten-free", "No restrictions"],
        },
      ],
    },
  },
  {
    id: "quiz",
    name: "Knowledge Quiz",
    category: "Quiz",
    description: "A multi-question quiz with a progress bar and scored answers.",
    tone: "violet",
    rating: 4.9,
    uses: "7.6k",
    schema: {
      title: "Test your knowledge",
      description: "10 quick questions.",
      settings: { theme: { accent: "#6D5EFA", radius: "md" } },
      blocks: [
        {
          id: "q1",
          type: "choice",
          label: "Which planet is closest to the sun?",
          required: true,
          options: ["Mercury", "Venus", "Earth", "Mars"],
        },
        {
          id: "q2",
          type: "choice",
          label: "What is the capital of Japan?",
          required: true,
          options: ["Kyoto", "Osaka", "Tokyo", "Nagoya"],
        },
      ],
    },
  },
  {
    id: "job",
    name: "Job Application",
    category: "Application",
    description: "Structured candidate intake with a résumé upload.",
    tone: "green",
    rating: 4.8,
    uses: "11.3k",
    schema: {
      title: "Apply — Product Designer",
      description: "We review every application.",
      settings: { theme: { accent: "#159C56", radius: "md" } },
      blocks: [
        { id: "name", type: "short", label: "Full name", required: true },
        { id: "email", type: "email", label: "Email", required: true },
        { id: "role", type: "short", label: "Role you're applying for", required: true },
        { id: "resume", type: "file", label: "Upload résumé", required: true },
        { id: "why", type: "long", label: "Why do you want this role?", required: true },
      ],
    },
  },
  {
    id: "payment",
    name: "Payment & Checkout",
    category: "Payment",
    description: "Take payments with an order summary and card capture.",
    tone: "violet",
    rating: 4.7,
    uses: "6.2k",
    schema: {
      title: "Complete your order",
      description: "Secure checkout.",
      settings: { theme: { accent: "#6D5EFA", radius: "md" }, submitLabel: "Pay now" },
      blocks: [
        { id: "name", type: "short", label: "Name on card", required: true },
        { id: "email", type: "email", label: "Email for receipt", required: true },
        {
          id: "plan",
          type: "dropdown",
          label: "Plan",
          required: true,
          options: ["Pro — $29/mo", "Business — $99/mo"],
        },
        { id: "pay", type: "payment", label: "Payment", required: true },
      ],
    },
  },
  {
    id: "customer-survey",
    name: "Customer Survey",
    category: "Survey",
    description: "A linear-scale satisfaction survey with follow-up questions.",
    tone: "amber",
    rating: 4.9,
    uses: "15.7k",
    schema: {
      title: "Customer survey",
      description: "Your input shapes what we build next.",
      settings: { theme: { accent: "#C4790B", radius: "md" } },
      blocks: [
        {
          id: "sat",
          type: "scale",
          label: "How satisfied are you overall?",
          required: true,
          min: 1,
          max: 5,
        },
        {
          id: "use",
          type: "choice",
          label: "How often do you use us?",
          required: false,
          options: ["Daily", "Weekly", "Monthly", "Rarely"],
        },
        { id: "more", type: "long", label: "Anything else you'd like to share?", required: false },
      ],
    },
  },
  {
    id: "time-off",
    name: "Time-Off Request",
    category: "HR",
    description: "Let employees request time off with reason and date range.",
    tone: "green",
    rating: 4.6,
    uses: "5.4k",
    schema: {
      title: "Time-off request",
      description: "Submit for manager approval.",
      settings: { theme: { accent: "#159C56", radius: "md" } },
      blocks: [
        { id: "name", type: "short", label: "Your name", required: true },
        {
          id: "reason",
          type: "dropdown",
          label: "Reason for time off",
          required: true,
          options: ["Vacation", "Sick leave", "Personal", "Other"],
        },
        { id: "start", type: "date", label: "Start date", required: true },
        { id: "end", type: "date", label: "End date", required: true },
      ],
    },
  },
  {
    id: "course-enrollment",
    name: "Course Enrollment",
    category: "Education",
    description: "Enroll students with course selection and preferences.",
    tone: "violet",
    rating: 4.8,
    uses: "4.9k",
    schema: {
      title: "Course enrollment",
      description: "Reserve your seat.",
      settings: { theme: { accent: "#6D5EFA", radius: "md" } },
      blocks: [
        { id: "name", type: "short", label: "Student name", required: true },
        { id: "email", type: "email", label: "Email", required: true },
        {
          id: "courses",
          type: "checkbox",
          label: "Which courses?",
          required: true,
          options: ["Intro to Design", "Advanced Figma", "Design Systems"],
        },
      ],
    },
  },
  {
    id: "contact-sales",
    name: "Contact Sales",
    category: "Lead generation",
    description: "Qualify inbound sales leads with company and budget details.",
    tone: "amber",
    rating: 4.7,
    uses: "8.1k",
    schema: {
      title: "Talk to sales",
      description: "Tell us a bit about your team.",
      settings: { theme: { accent: "#C4790B", radius: "md" } },
      blocks: [
        { id: "name", type: "short", label: "Full name", required: true },
        { id: "company", type: "short", label: "Company name", required: true },
        {
          id: "budget",
          type: "dropdown",
          label: "Budget range",
          required: false,
          options: ["< $1k/mo", "$1k–5k/mo", "$5k–20k/mo", "$20k+/mo"],
        },
        { id: "message", type: "long", label: "What are you looking to solve?", required: false },
      ],
    },
  },
  {
    id: "contact",
    name: "Contact Us",
    category: "Feedback",
    description: "Let visitors reach you with a message and email.",
    tone: "green",
    rating: 4.9,
    uses: "21.5k",
    schema: {
      title: "Contact us",
      description: "We'll get back to you shortly.",
      settings: { theme: { accent: "#159C56", radius: "md" } },
      blocks: [
        { id: "message", type: "long", label: "What's on your mind?", required: true },
        { id: "email", type: "email", label: "Your email", required: true },
      ],
    },
  },
  {
    id: "newsletter",
    name: "Newsletter Signup",
    category: "Lead generation",
    description: "Grow your list and capture topic interests.",
    tone: "blue",
    rating: 4.8,
    uses: "13.2k",
    schema: {
      title: "Join the newsletter",
      description: "One email a week. No spam, ever.",
      settings: { theme: { accent: "#2F6BE4", radius: "lg" }, submitLabel: "Subscribe" },
      blocks: [
        { id: "email", type: "email", label: "Email", required: true },
        {
          id: "topics",
          type: "checkbox",
          label: "What are you interested in?",
          required: false,
          options: ["Product", "Engineering", "Design", "Company news"],
        },
      ],
    },
  },
  {
    id: "bug",
    name: "Bug Report",
    category: "Product",
    description: "Let users report issues with severity and a screenshot.",
    tone: "red",
    rating: 4.7,
    uses: "6.9k",
    schema: {
      title: "Report a bug",
      description: "Thanks for helping us squash it.",
      settings: { theme: { accent: "#DC4B47", radius: "md" } },
      blocks: [
        { id: "title", type: "short", label: "Summary", required: true },
        { id: "steps", type: "long", label: "Steps to reproduce", required: true },
        {
          id: "severity",
          type: "dropdown",
          label: "Severity",
          required: true,
          options: ["Low", "Medium", "High", "Critical"],
        },
        { id: "shot", type: "file", label: "Screenshot", required: false },
      ],
    },
  },
];

/** Community-shared templates (rendered in their own section). */
export const COMMUNITY_TEMPLATES: Template[] = [
  {
    id: "community-signup",
    name: "Community Sign-Up",
    category: "Community",
    description: "Onboard new members with tier selection and interests.",
    tone: "violet",
    rating: 4.8,
    uses: "6.7k",
    schema: {
      title: "Join the community",
      description: "Welcome aboard!",
      settings: { theme: { accent: "#6D5EFA", radius: "lg" } },
      blocks: [
        { id: "name", type: "short", label: "Your name", required: true },
        { id: "email", type: "email", label: "Email", required: true },
        {
          id: "tier",
          type: "choice",
          label: "Membership tier",
          required: true,
          options: ["Free", "Supporter", "Founding member"],
        },
      ],
    },
  },
  {
    id: "community-standup",
    name: "Async Standup",
    category: "Community",
    description: "A daily async check-in shared by a remote team.",
    tone: "green",
    rating: 4.7,
    uses: "3.1k",
    schema: {
      title: "Daily standup",
      description: "Keep the team in sync.",
      settings: { theme: { accent: "#159C56", radius: "md" } },
      blocks: [
        { id: "yesterday", type: "long", label: "What did you do yesterday?", required: true },
        { id: "today", type: "long", label: "What are you working on today?", required: true },
        { id: "blockers", type: "short", label: "Any blockers?", required: false },
      ],
    },
  },
  {
    id: "community-testimonial",
    name: "Testimonial Collector",
    category: "Community",
    description: "Gather glowing quotes with a rating and permission to share.",
    tone: "amber",
    rating: 4.9,
    uses: "5.5k",
    schema: {
      title: "Share your story",
      description: "We'd love to feature you.",
      settings: { theme: { accent: "#C4790B", radius: "md" } },
      blocks: [
        { id: "rating", type: "rating", label: "How would you rate us?", required: true },
        { id: "quote", type: "long", label: "Your testimonial", required: true },
        {
          id: "consent",
          type: "choice",
          label: "Can we share this publicly?",
          required: true,
          options: ["Yes", "No"],
        },
      ],
    },
  },
];
