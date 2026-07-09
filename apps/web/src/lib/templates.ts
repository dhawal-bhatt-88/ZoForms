import type { FormSchema } from "@formbuilder/form-schema";

export type Template = {
  id: string;
  name: string;
  category: string;
  description: string;
  schema: FormSchema;
};

export const CATEGORIES = [
  "All",
  "General",
  "Feedback",
  "Events",
  "HR",
  "Product",
] as const;

export const TEMPLATES: Template[] = [
  {
    id: "contact",
    name: "Contact form",
    category: "General",
    description: "Let visitors reach you with a name, email, and message.",
    schema: {
      title: "Contact us",
      description: "We'll get back to you shortly.",
      settings: { theme: { accent: "#6D5EFA", radius: "md" } },
      blocks: [
        { id: "name", type: "short", label: "Your name", required: true },
        { id: "email", type: "email", label: "Email", required: true },
        { id: "message", type: "long", label: "How can we help?", required: true },
      ],
    },
  },
  {
    id: "feedback",
    name: "Customer feedback",
    category: "Feedback",
    description: "Measure satisfaction with a rating, comments, and NPS.",
    schema: {
      title: "How are we doing?",
      description: "Your feedback helps us improve.",
      settings: { theme: { accent: "#159C56", radius: "md" } },
      blocks: [
        { id: "rating", type: "rating", label: "How would you rate your experience?", required: true },
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
    id: "rsvp",
    name: "Event RSVP",
    category: "Events",
    description: "Collect attendance, guest counts, and dietary needs.",
    schema: {
      title: "You're invited 🎉",
      description: "Please RSVP by Friday.",
      settings: { theme: { accent: "#E1663E", radius: "lg" } },
      blocks: [
        { id: "name", type: "short", label: "Your name", required: true },
        { id: "email", type: "email", label: "Email", required: true },
        {
          id: "attending",
          type: "choice",
          label: "Will you attend?",
          required: true,
          options: ["Yes, I'll be there", "Sorry, can't make it"],
        },
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
    id: "job",
    name: "Job application",
    category: "HR",
    description: "Structured candidate intake with a résumé upload.",
    schema: {
      title: "Apply — Product Designer",
      description: "We review every application.",
      settings: { theme: { accent: "#18181B", radius: "md" } },
      blocks: [
        { id: "name", type: "short", label: "Full name", required: true },
        { id: "email", type: "email", label: "Email", required: true },
        { id: "phone", type: "phone", label: "Phone", required: false },
        { id: "resume", type: "file", label: "Résumé (PDF)", required: true },
        { id: "why", type: "long", label: "Why do you want to work here?", required: true },
      ],
    },
  },
  {
    id: "newsletter",
    name: "Newsletter signup",
    category: "General",
    description: "Grow your list and capture topic interests.",
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
    name: "Bug report",
    category: "Product",
    description: "Let users report issues with severity and a screenshot.",
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
