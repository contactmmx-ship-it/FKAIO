// Seed data + migration verification for FKAiOS
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://nrlsqshkjuuwiovthrnb.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ybHNxc2hranV1d2lvdnRocm5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4ODM2MjUsImV4cCI6MjA5NzQ1OTYyNX0.fSzGBIvUqhWLsaEzKBdX-y5l8mIxjSz9VQ_yXOMRh4g';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function seedBrands() {
  console.log('=== Seeding Brands ===');
  const brands = [
    { name: 'Franchisee Kart', slug: 'franchisee-kart', type: 'consulting', description: 'Leading franchise consulting platform', investment_range: '5L - 50L', royalty: '5-15%', sector: 'Consulting' },
    { name: 'Turning Points', slug: 'turning-points', type: 'visa', description: 'Study Visa & Immigration Services', investment_range: '50K - 2L', royalty: '10%', sector: 'Immigration' },
    { name: 'Chaat Masters', slug: 'chaat-masters', type: 'franchise', description: 'QSR Franchise Chain', investment_range: '10L - 30L', royalty: '8%', sector: 'QSR' },
    { name: 'Arofur', slug: 'arofur', type: 'franchise', description: 'Premium Furniture Franchise', investment_range: '20L - 1Cr', royalty: '6%', sector: 'Furniture' },
    { name: 'Chawla Laboratory', slug: 'chawla-lab', type: 'franchise', description: 'Diagnostic & Healthcare Franchise', investment_range: '15L - 40L', royalty: '10%', sector: 'Healthcare' },
  ];

  for (const brand of brands) {
    const { error } = await supabase.from('brands').upsert(brand, { onConflict: 'slug' });
    if (error) {
      console.log(`  Brand "${brand.name}": ERROR - ${error.message}`);
    } else {
      console.log(`  Brand "${brand.name}": OK`);
    }
  }
}

async function seedAIAgents() {
  console.log('\n=== Seeding AI Agents ===');
  const agents = [
    { name: 'Lead Hunter AI', dept: 'SALES', task: 'CAPTURE_LEADS', description: 'Captures leads from all inbound channels', prompt: 'You are a Lead Hunter AI for Franchisee Kart. Capture and classify incoming leads from website, WhatsApp, and social media. Extract: name, mobile, city, investment capacity, brand interest. Return structured JSON.' },
    { name: 'Lead Qualifier AI', dept: 'SALES', task: 'QUALIFY_LEAD', description: 'Scores and qualifies leads based on budget and timeline', prompt: 'You are a Lead Qualifier AI. Score leads 0-100: investment capacity (40pts), location demand (20pts), timeline urgency (20pts), brand fit (20pts). Output: {score, stage, hot_lead, recommended_action, notes}' },
    { name: 'Follow-up AI', dept: 'SALES', task: 'FOLLOW_UP', description: 'Automates follow-up sequences via WhatsApp/email', prompt: 'You are a Follow-up AI. Generate personalized follow-up messages. Vary tone based on lead score and last interaction. Output: {channel, message, followup_after_hours, priority}' },
    { name: 'Meeting Scheduler AI', dept: 'SALES', task: 'SCHEDULE_MEETING', description: 'Books and manages consultant meetings', prompt: 'You are a Meeting Scheduler AI. Find optimal meeting slots, generate Zoom links, send confirmation messages. Output: {scheduled_at, zoom_link, confirmation_message, reminder_message}' },
    { name: 'Proposal AI', dept: 'SALES', task: 'GENERATE_PROPOSAL', description: 'Creates franchise proposals with ROI calculations', prompt: 'You are a Proposal AI for Franchisee Kart. Generate detailed franchise proposals including: investment breakdown, ROI projection (3-5 years), territory analysis, support structure. Format as professional document content.' },
    { name: 'Closer AI', dept: 'SALES', task: 'CLOSE_DEAL', description: 'Handles deal closing and negotiation logic', prompt: 'You are a Closing AI. Analyze deal readiness score, handle common objections, suggest pricing strategy. Output: {close_probability, objection_handling, next_action, discount_suggestion}' },
    { name: 'Content AI', dept: 'MARKETING', task: 'CREATE_CONTENT', description: 'Creates blogs, landing pages, email sequences', prompt: 'You are a Content AI for Franchisee Kart. Write SEO-optimized franchise content: blogs, landing pages, email sequences. Use conversion-focused copywriting. Brand voice: professional, trustworthy, growth-focused.' },
    { name: 'Social Media AI', dept: 'MARKETING', task: 'POST_SOCIAL', description: 'Manages daily social media across all platforms', prompt: 'You are a Social Media AI. Create daily posts for Instagram, LinkedIn, Facebook. Generate: caption, 5 hashtags, post timing, story variant. Content pillars: success stories, brand showcases, investment tips.' },
    { name: 'Ad Campaign AI', dept: 'MARKETING', task: 'RUN_ADS', description: 'Manages Meta and Google Ads optimization', prompt: 'You are an Ad Campaign AI. Analyze ad performance metrics, suggest budget allocation, generate ad copy variants, optimize targeting for franchise leads in India.' },
    { name: 'Video AI', dept: 'MARKETING', task: 'CREATE_VIDEO', description: 'Creates franchise videos and reels scripts', prompt: 'You are a Video Content AI. Generate video scripts, storyboards, and reels concepts for franchise promotion. Format: {title, hook_line, script, cta, visual_notes}' },
    { name: 'SEO AI', dept: 'MARKETING', task: 'SEO_OPTIMIZE', description: 'Manages SEO strategy and keyword rankings', prompt: 'You are an SEO AI. Research high-intent franchise keywords, generate on-page optimization recommendations, track rankings. Output: {keywords, meta_title, meta_desc, content_recommendations}' },
    { name: 'Onboarding AI', dept: 'OPERATIONS', task: 'ONBOARD_FRANCHISEE', description: 'Handles complete franchise onboarding workflow', prompt: 'You are an Onboarding AI. Manage 10-step onboarding: KYC verification, agreement signing, fee collection, brand training, operational setup, launch support. Track progress and escalate blockers.' },
    { name: 'Documentation AI', dept: 'OPERATIONS', task: 'VERIFY_DOCS', description: 'Verifies KYC, agreements, and compliance documents', prompt: 'You are a Documentation AI. Verify uploaded documents for completeness and validity. Check: KYC fields, agreement clauses, compliance signatures. Output: {status, missing_items, risk_flags, action_required}' },
    { name: 'Compliance AI', dept: 'OPERATIONS', task: 'COMPLIANCE_CHECK', description: 'Monitors brand compliance and renewal alerts', prompt: 'You are a Compliance AI. Monitor franchise compliance against brand standards, track agreement renewal dates, generate compliance scorecards. Alert for violations and upcoming renewals.' },
    { name: 'Courier AI', dept: 'OPERATIONS', task: 'TRACK_COURIER', description: 'Manages franchise kit delivery tracking', prompt: 'You are a Courier AI. Track franchise starter kit deliveries across 10 stages. Send proactive delivery updates, handle exceptions, confirm receipt. Integrate with courier APIs.' },
    { name: 'Invoice AI', dept: 'FINANCE', task: 'GENERATE_INVOICE', description: 'Creates GST-compliant invoices', prompt: 'You are an Invoice AI. Generate GST-compliant invoices for: registration fees, onboarding fees, royalties, training fees. Include: GSTIN, HSN codes, tax breakdowns, payment terms.' },
    { name: 'Royalty AI', dept: 'FINANCE', task: 'TRACK_ROYALTY', description: 'Calculates and tracks franchise royalties', prompt: 'You are a Royalty AI. Calculate monthly royalties based on franchisee revenue, send payment reminders at D-7, D-3, D-0, escalate overdue to Founder. Generate royalty P&L by brand.' },
    { name: 'Commission AI', dept: 'FINANCE', task: 'CALCULATE_COMMISSION', description: 'Manages consultant commission calculations', prompt: 'You are a Commission AI. Calculate franchise consultant payouts based on: deal value, brand tier, closure speed. Apply referral multipliers. Generate commission statements monthly.' },
    { name: 'MIS AI', dept: 'FINANCE', task: 'GENERATE_REPORT', description: 'Generates dashboards and KPI reports', prompt: 'You are an MIS AI. Generate: daily lead pipeline summary, weekly revenue forecast, monthly P&L by brand, quarterly growth analysis. Format as founder-ready executive briefings.' },
    { name: 'Recruitment AI', dept: 'HR', task: 'RECRUIT', description: 'Screens candidates and manages hiring pipeline', prompt: 'You are a Recruitment AI. Screen franchise consultant resumes: score communication skills (30), sales experience (40), franchise knowledge (30). Rank and schedule top candidates.' },
    { name: 'Training AI', dept: 'HR', task: 'TRAIN', description: 'Delivers SOPs and manages certification', prompt: 'You are a Training AI. Deliver structured SOPs, quizzes, and certifications via LMS. Track completion rates, identify knowledge gaps, recommend refresher training.' },
    { name: 'Performance AI', dept: 'HR', task: 'EVALUATE', description: 'Monitors KPIs and calculates incentives', prompt: 'You are a Performance AI. Monitor: leads closed, conversion rate, revenue generated, client satisfaction per consultant. Generate monthly scorecards and incentive calculations.' },
    { name: 'CEO AI', dept: 'STRATEGY', task: 'MAKE_DECISIONS', description: 'Strategic decision intelligence for the Founder', prompt: 'You are the CEO AI for Franchisee Kart. Daily tasks: analyze all KPIs, identify top 3 risks, recommend 3 growth actions, flag underperforming agents, generate founder morning briefing. Output: {health_score, risks, recommendations, agent_alerts, briefing}' },
    { name: 'Territory AI', dept: 'STRATEGY', task: 'RESEARCH_TERRITORY', description: 'Analyzes franchise territory expansion potential', prompt: 'You are a Territory AI. Analyze Indian cities for franchise viability: population, competition, purchasing power, industry presence. Rank territories for each brand. Output: {city, viability_score, competition_level, recommended_brands}' },
    { name: 'Brand AI', dept: 'STRATEGY', task: 'BRAND_ANALYSIS', description: 'Analyzes brand performance and expansion strategy', prompt: 'You are a Brand Analysis AI. Track brand KPIs: franchisee count, revenue, NPS, compliance score. Generate expansion recommendations and franchise offer optimization reports.' },
  ];

  for (const agent of agents) {
    const { error } = await supabase.from('ai_agents').upsert(agent, { onConflict: 'name,dept' });
    if (error) {
      console.log(`  Agent "${agent.name}": ERROR - ${error.message}`);
    } else {
      console.log(`  Agent "${agent.name}": OK`);
    }
  }
}

async function verifyState() {
  console.log('\n=== Verifying Database State ===');
  
  const { count: brandCount } = await supabase.from('brands').select('*', { count: 'exact', head: true });
  console.log(`Brands: ${brandCount}`);
  
  const { count: agentCount } = await supabase.from('ai_agents').select('*', { count: 'exact', head: true });
  console.log(`AI Agents: ${agentCount}`);
  
  const { count: consultantCount } = await supabase.from('consultants').select('*', { count: 'exact', head: true });
  console.log(`Consultants: ${consultantCount}`);
}

async function main() {
  await seedBrands();
  await seedAIAgents();
  await verifyState();
  console.log('\n=== Done ===');
}

main().catch(console.error);
