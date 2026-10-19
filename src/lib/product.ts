// The SaaS product the bot sells. Edit this file to pitch a different product.
export const PRODUCT = {
  name: "FlowCRM",
  tagline: "The simple CRM for small businesses in India",
  description:
    "FlowCRM helps small teams track leads, automate WhatsApp and email follow-ups, and see their whole sales pipeline in one place.",
  features: [
    "Visual sales pipeline with drag-and-drop deals",
    "Automatic WhatsApp and email follow-up reminders",
    "Lead capture from website forms, Instagram and IndiaMART",
    "GST-ready quotes and invoices in one click",
    "Mobile app for field sales teams",
    "Daily sales reports for the owner",
  ],
  pricing: [
    { plan: "Starter", price: "₹999 per month", details: "up to 3 users, 1,000 contacts" },
    { plan: "Growth", price: "₹2,499 per month", details: "up to 10 users, unlimited contacts, WhatsApp automation" },
    { plan: "Business", price: "₹5,999 per month", details: "unlimited users, custom reports, priority support" },
  ],
  offer: "14-day free trial, no credit card needed, and 20% off the first 3 months if they sign up on this call.",
  objections: {
    "too expensive": "Starter is about ₹33 a day — less than one cup of chai per user. Most customers recover that from a single deal they would have forgotten to follow up on.",
    "already using Excel or another tool": "We import Excel sheets and other CRMs in minutes, for free, and our team does the migration for you.",
    "no time": "Setup takes about 10 minutes, and we give a free onboarding call.",
    "need to think / ask partner": "Totally fine — the free trial lets you try it with your team first. I can also book a short demo with your partner.",
    "data security": "Data is encrypted, stored in India, and you can export everything at any time.",
  },
};
