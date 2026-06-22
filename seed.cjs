const { createClient } = require('@supabase/supabase-js');
const URL = 'https://nrlsqshkjuuwiovthrnb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ybHNxc2hranV1d2lvdnRocm5iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTg4MzYyNSwiZXhwIjoyMDk3NDU5NjI1fQ.a2-BmgsCylzO6lxhFwJYlWOGuQi-zLcW9psDnW6OqEY';
const db = createClient(URL, SERVICE_KEY);

async function seed() {
  console.log('=== FKAiOS Seeding (Actual DB Schema) ===\n');

  // 1. Try to create founder user
  console.log('1. Founder user...');
  let founderId;
  try {
    const { data: { users } } = await db.auth.admin.listUsers();
    founderId = users?.find(u => u.email === 'founder@franchiseekart.com')?.id;
    if (founderId) {
      console.log('   Exists:', founderId);
    } else {
      console.log('   Not found. User needs to sign up from the Login page.');
      console.log('   OR create in Supabase Dashboard > Authentication > Users');
    }
  } catch(e) {
    console.log('   Will create via app signup');
  }

  // 2. Brands
  console.log('\n2. Brands...');
  const { count: bc } = await db.from('brands').select('*', { count: 'exact', head: true });
  console.log('   Existing:', bc);

  // 3. Consultants (actual schema: name, email, role, phone, department, status - NO is_active)
  console.log('\n3. Consultants...');
  const { data: existingConsul } = await db.from('consultants').select('*');
  console.log('   Existing:', existingConsul?.length || 0);
  if (!existingConsul?.some(c => c.email === 'priya@franchiseekart.com')) {
    const { error } = await db.from('consultants').insert([
      { name: 'Priya Sharma', email: 'priya@franchiseekart.com', phone: '+91 87654 32109', role: 'RM', department: 'Sales', status: 'active' },
      { name: 'Rahul Verma', email: 'rahul@franchiseekart.com', phone: '+91 76543 21098', role: 'OpsHead', department: 'Operations', status: 'active' },
      { name: 'Anita Desai', email: 'anita@franchiseekart.com', phone: '+91 65432 10987', role: 'Accounts', department: 'Finance', status: 'active' },
      { name: 'Vikram Singh', email: 'vikram@franchiseekart.com', phone: '+91 54321 09876', role: 'BrandManager', department: 'Brand Development', status: 'active' },
    ]);
    console.log(error ? '   Error: ' + error.message.substring(0, 80) : '   Inserted 4 more consultants');
  }

  // 4. Leads (actual: contact_name, contact_email, contact_phone, location, lead_source, company_name REQUIRED NOT NULL)
  console.log('\n4. Leads...');
  const { count: lc } = await db.from('leads').select('*', { count: 'exact', head: true });
  if (lc === 0) {
    const { data: bids } = await db.from('brands').select('id');
    const { data: cids } = await db.from('consultants').select('id').eq('role', 'RM');
    // Valid stages: contacted, qualified, proposal_sent, negotiation, lost
    const stages = ['contacted','contacted','contacted','qualified','qualified','proposal_sent','proposal_sent','negotiation','negotiation','lost'];
    const sources = ['Website','Referral','Facebook','Instagram','JustDial','Google Ads','WhatsApp','LinkedIn','Email','Phone'];
    const locs = ['Mumbai','Delhi','Bangalore','Pune','Hyderabad','Chennai','Jaipur','Lucknow','Kolkata','Ahmedabad',
                   'Mumbai','Delhi','Bangalore','Pune','Hyderabad','Chennai','Jaipur','Lucknow','Kolkata','Ahmedabad',
                   'Mumbai','Delhi','Bangalore','Pune','Hyderabad','Chennai','Jaipur','Lucknow','Kolkata','Ahmedabad'];
    const invs = ['5-10 Lakhs','10-15 Lakhs','15-25 Lakhs','25-50 Lakhs','50 Lakhs+'];
    const names = ['Amit Patel','Sneha Reddy','Rajesh Kumar','Deepika Nair','Manish Gupta',
      'Pooja Mehta','Suresh Babu','Kavita Joshi','Arjun Das','Neha Saxena',
      'Vikas Rao','Ritu Agarwal','Sanjay Mishra','Divya Menon','Karan Thakur',
      'Anjali Sharma','Pradeep Verma','Meghna Iyer','Rohit Kulkarni','Shalini Gupta',
      'Ashok Pandey','Bhavna Rathi','Dinesh Chauhan','Rekha Pillai','Gaurav Jain',
      'Swati Bhatt','Narendra Singh','Lata Mohan','Tarun Bhatia','Suman Devi'];
    
    const leads = names.map((name, i) => ({
      contact_name: name,
      contact_phone: '+91 ' + String(9000000000 + Math.floor(Math.random() * 999999999)),
      contact_email: name.toLowerCase().replace(/ /g, '.') + '@gmail.com',
      location: locs[i],
      lead_source: sources[i % sources.length],
      company_name: name.split(' ')[1] + ' Enterprises',
      brand_id: bids?.[i % (bids?.length || 1)]?.id || null,
      assigned_to: cids?.[i % (cids?.length || 1)]?.id || null,
      investment_capacity: invs[i % invs.length],
      lead_score: Math.floor(Math.random() * 60) + 30,
      stage: stages[i % stages.length],
      notes: i % 5 === 0 ? 'Very interested. Follow up soon.' : null,
    }));
    const { error } = await db.from('leads').insert(leads);
    console.log(error ? '   Error: ' + error.message.substring(0, 100) : '   Inserted ' + leads.length + ' leads');
  } else {
    console.log('   Already exist:', lc);
  }

  // 5. Meetings
  console.log('\n5. Meetings...');
  const { count: mc } = await db.from('meetings').select('*', { count: 'exact', head: true });
  if (mc === 0) {
    const { data: lids } = await db.from('leads').select('id').limit(5);
    const { data: cids2 } = await db.from('consultants').select('id').limit(3);
    const { error } = await db.from('meetings').insert(
      lids?.map((l, i) => ({
        lead_id: l.id,
        consultant_id: cids2?.[i % (cids2?.length || 1)]?.id,
        scheduled_at: new Date(Date.now() + (i + 1) * 86400000).toISOString(),
        status: i < 3 ? 'Scheduled' : 'Completed',
        notes: i === 0 ? 'Discuss franchise terms' : null,
      })) || []
    );
    console.log(error ? '   Error: ' + error.message.substring(0, 80) : '   Inserted meetings');
  } else {
    console.log('   Already exist:', mc);
  }

  // 6. Invoices
  console.log('\n6. Invoices...');
  const { count: ic } = await db.from('invoices').select('*', { count: 'exact', head: true });
  if (ic === 0) {
    const { data: lids2 } = await db.from('leads').select('id').limit(5);
    const { error } = await db.from('invoices').insert(
      lids2?.map((l, i) => ({
        lead_id: l.id,
        type: ['Registration Fee','Franchise Fee','Training Fee','Setup Fee','Consultation'][i],
        amount: [50000, 250000, 15000, 75000, 10000][i],
        status: ['Paid','Pending','Paid','Overdue','Pending'][i],
        due_date: new Date(Date.now() + (i * 15 - 5) * 86400000).toISOString(),
      })) || []
    );
    console.log(error ? '   Error: ' + error.message.substring(0, 80) : '   Inserted invoices');
  } else {
    console.log('   Already exist:', ic);
  }

  // 7. Notifications
  console.log('\n7. Notifications...');
  if (founderId) {
    try {
      const { error } = await db.from('notifications').insert([
        { user_id: founderId, title: 'Welcome to FKAiOS', message: 'Your AI Operating System is live!', type: 'success', read: false },
        { user_id: founderId, title: 'New Lead', message: 'Amit Patel assigned to you.', type: 'lead', read: false },
        { user_id: founderId, title: 'AI Job Done', message: 'Lead Scorer processed leads.', type: 'ai', read: true },
      ]);
      console.log(error ? '   Error: ' + error.message.substring(0, 80) : '   Inserted 3 notifications');
    } catch(e) {
      console.log('   Skipped:', e.message?.substring(0, 60));
    }
  }

  // Summary
  const { count: finalLeads } = await db.from('leads').select('*', { count: 'exact', head: true });
  const { count: finalAgents } = await db.from('ai_agents').select('*', { count: 'exact', head: true });
  const { count: finalBrands } = await db.from('brands').select('*', { count: 'exact', head: true });
  
  console.log('\n=== Seeding Complete ===');
  console.log('  Leads:', finalLeads, '| AI Agents:', finalAgents, '| Brands:', finalBrands);
  console.log('\n  To create your account, go to:');
  console.log('  Supabase Dashboard > Authentication > Users > Add User');
  console.log('  Email: founder@franchiseekart.com | Password: Founder@2024');
  console.log('  Then sign in at the Login page of the app.\n');
}

seed().catch(e => console.error('Failed:', e));
