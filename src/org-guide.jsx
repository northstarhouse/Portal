// Admin > Organization Guide: the North Star House Overview & Organizational Guide as a scrollable, searchable page.
// The text below is the guide (edit it here to update the page). Sections marked "To be completed" are still blank in the
// printed guide. Search narrows the page to the sections that match and highlights the words.
const GOLD = '#886c44';
const SERIF = "'Cardo', Georgia, serif";

const TBD = { t: 'tbd' };
// Block types: p (paragraph, **bold** allowed), h (heading), ul / check (bullet or checkbox lists; an item can be {text, sub:[...]}),
// table, tbd (blank in the printed guide), note (italic), fields (a form's blanks), quote (letter text).
const GUIDE = [
  { id: 'overview', group: 'guide', title: 'Organization Overview', blocks: [
    { t: 'p', text: 'The North Star House is a historic 1905 estate in Grass Valley, California, designed by Julia Morgan, California’s first licensed female architect. It was commissioned by James Hague, owner of the North Star Mine, and the house was intended as a gathering place for mining engineers and dignitaries, along with the residence of mine superintendent Arthur De Wint Foote and his wife, Mary Hallock Foote, a renowned author and illustrator. Set on 14 acres, the property stands as an enduring piece of regional and architectural history.' },
    { t: 'p', text: 'After decades of neglect, the home fell into serious disrepair with its structure compromised and its grounds overtaken. Ownership was eventually transferred to the Nevada County Land Trust (now Bear Yuba Land Trust), and in 2015, stewardship passed to the North Star Historic Conservancy. This nonprofit organization was formed to **restore the house and use it as a valuable resource for the community.**' },
    { t: 'p', text: 'Significant restoration efforts have since taken place, with the first floor of the house almost fully restored. Structural repairs, restored finishes, and revitalized grounds have transformed the site into a welcoming space once again. The North Star House now serves as a multi-use venue: hosting weddings, educational programs, community events, and art experiences that generate revenue to fund continued restoration and operations.' },
    { t: 'p', text: 'The Conservancy’s work is ongoing, with priorities including second-floor restoration, expanded ADA access, and fire suppression infrastructure. Through a combination of historic preservation, community engagement, and creative use of space, the North Star House is once again fulfilling its original purpose: bringing people together.' },
  ] },
  { id: 'mission', group: 'guide', title: 'Mission and Vision Statement', blocks: [
    { t: 'p', text: '**Mission:** To restore North Star House as a cultural gathering center, bringing the magic of the arts, theater, literature, history and music to generations of children, youth, and adults as well as providing a unique environment that nourishes the creative spirit.' },
    { t: 'p', text: '**Vision:**' }, TBD,
  ] },
  { id: 'structure', group: 'guide', title: 'Organizational Structure', blocks: [
    { t: 'h', text: 'Board of Directors' },
    { t: 'p', text: 'The North Star House is led by a working Board of Directors responsible for strategic oversight, policy development, and fiduciary stewardship. In addition to guiding the organization’s long-term vision, each board member serves as a liaison to one or more standing committees, ensuring strong communication, collaboration, and alignment across all areas of operation.' },
    { t: 'h', text: 'Board Roles' },
    { t: 'role', name: 'President of the Board', fields: ['Responsibilities', 'Oversees', 'Decision Authority', 'When People Should Come to This Role'] },
    { t: 'role', name: 'Treasurer', fields: ['Responsibilities', 'Decision Authority', 'When People Should Come to This Role'] },
    { t: 'role', name: 'Secretary', fields: ['Responsibilities', 'When People Should Come to This Role'] },
    { t: 'role', name: 'Board Member', fields: ['Responsibilities', 'Decision Authority'] },
    { t: 'h', text: 'Staff Roles & Reporting Structure' },
    { t: 'role', name: 'General Manager + Marketing (Haley)', fields: ['Reports to', 'Oversees'] },
    { t: 'role', name: 'House Manager + Venue Coordinator (Jen)', fields: ['Reports to', 'Oversees'] },
    { t: 'role', name: 'Property Manager (Cliff)', fields: ['Reports to', 'Oversees'] },
    { t: 'role', name: 'Venue Coordinator (Sierra)', fields: ['Reports to', 'Oversees'] },
    { t: 'role', name: 'Site Managers (Gerrie, Doreen, & Honey)', fields: ['Reports to', 'Oversees'] },
  ] },
  { id: 'areas', group: 'guide', title: 'Operational Areas', blocks: [
    { t: 'h', text: 'Restoration & New Construction' },
    { t: 'p', text: 'Focused on preservation, repair, and ongoing construction of North Star House.' },
    { t: 'role', name: 'Board Liaison', fields: ['Reports to', 'Responsibilities', 'Oversees'] },
    { t: 'role', name: 'Architect', fields: ['Reports to', 'Responsibilities', 'Oversees'] },
    { t: 'role', name: 'Co-Architect', fields: ['Reports to', 'Responsibilities', 'Oversees'] },
    { t: 'role', name: 'Contractor', fields: ['Reports to', 'Responsibilities', 'Oversees'] },
    { t: 'role', name: 'Volunteer', fields: ['Reports to', 'Responsibilities'] },
    { t: 'h', text: 'Garden & Grounds' },
    { t: 'p', text: 'Oversees landscaping, outdoor maintenance, and the care of the property’s natural environment to support aesthetics, sustainability, and visitor experience' },
    { t: 'p', text: '**Lead:** Paula Campbell' },
    { t: 'p', text: '**Responsibilities:** Plans and coordinates improvements and routine maintenance across the 14-acre property in accordance with the Master Plan. Organizes volunteers and work parties, develops project cost estimates, coordinates historic plantings and the Heritage Garden, works with the Property Manager on grounds maintenance and equipment, and coordinates with Restoration & Construction on projects affecting the landscape.' },
    { t: 'h', text: 'Interiors' },
    { t: 'p', text: 'Focuses on historically informed furnishings, finishes, and design elements within the home' },
    { t: 'p', text: '**Lead:** Rebekah Freeman' },
    { t: 'p', text: '**Responsibilities:** Maintains inventories of furnishings, displays, art, and other items within the House. Reviews and makes recommendations regarding the purchase, acceptance, restoration, placement, and removal of furnishings and artifacts, with particular attention to the historic character of the first floor. Coordinates with History and Docents on historical significance, assists with second-floor furnishings, and manages inventory and deaccession procedures in accordance with the Interiors Committee Policy.' },
    { t: 'h', text: 'Marketing & Public Communications' },
    { t: 'p', text: 'Manages how the North Star House is presented to the public.' },
    { t: 'p', text: '**Lead:** Haley Wright' },
    { t: 'p', text: '**Responsibilities:** Manages digital and print communications, including the website, social media, newsletters, press relations, event publicity, and promotional materials. Develops messaging and marketing strategies, coordinates with committees on campaigns and events, supports donor and membership outreach, manages event ticketing communications, and helps ensure consistent public-facing information across platforms.' },
    { t: 'h', text: 'Venue Team' },
    { t: 'p', text: 'Oversees venue operations' },
    { t: 'p', text: '**Lead:** ' }, TBD,
    { t: 'p', text: '**Responsibilities:** Handles client communication and overall client experience, manages rental inquiries and scheduling, coordinates tours, and oversees Site Manager scheduling. The Committee Policy does not define a separate “Venue Team,” but related responsibilities are assigned to the Administrative Subcommittee, including maintaining the property calendar, reviewing use agreements, establishing office procedures, supervising private event management, coordinating maintenance related to events, and maintaining event-use data.' },
  ] },
  { id: 'committees', group: 'guide', title: 'Committees', blocks: [
    { t: 'h', text: 'Events Committee (Second Tuesday – 10am)' },
    { t: 'p', text: 'Plans public and donor events, manages refreshments, and coordinates volunteer support.' },
    { t: 'p', text: '**Lead:** ' }, TBD,
    { t: 'p', text: '**Responsibilities:** Plans, manages, and produces annual NSHC-sponsored events. Develops the yearly event calendar for Board approval, coordinates volunteer, donor, and member appreciation events, and works with Marketing on publicity, ticketing, and promotional materials. Solicits financial and in-kind event support and coordinates with other committees on proposed public and in-house events.' },
    { t: 'h', text: 'Planning Committee (First Tuesday – 12:30pm)' },
    { t: 'p', text: 'Focuses on long-term development, organizational coordination, and strategic priorities.' },
    { t: 'p', text: '**Lead:** Rick Panos' },
    { t: 'p', text: '**Responsibilities:** Reviews and monitors the Master Plan; oversees plans for landscaping, historic gardens, lighting, infrastructure, and signage; develops proposed improvement projects; and submits projects, priorities, and funding recommendations to the Board. Maintains design standards, coordinates permitting and zoning compliance, and maintains relationships with government agencies. The committee may approve plans and major plan modifications by majority vote, with appeals going to the Board' },
    { t: 'h', text: 'Executive Committee (First Thursday – 1pm)' },
    { t: 'p', text: 'Provides executive oversight and may make decisions on behalf of the Board when necessary and permitted under the NSHC Bylaws.' },
    { t: 'p', text: '**Lead:** Kenneth Underwood - Board President' },
    { t: 'p', text: '**Responsibilities:** Comprised of the President, Vice President, Secretary, Treasurer, and immediate Past President. Meets monthly and may act on behalf of the Board when required and consistent with the Bylaws. The Executive Committee may also appoint ad hoc committees as needed.' },
    { t: 'h', text: 'Development Committee (First Thursday – 10am)' },
    { t: 'p', text: 'Leads fundraising and donor engagement initiatives, including sponsorships, grants, memberships, and legacy giving programs.' },
    { t: 'p', text: '**Lead:** Kaelen Jennings' },
    { t: 'p', text: '**Responsibilities:** Manages the Conservancy’s comprehensive fundraising and outreach program to support maintenance and restoration of North Star House. Oversees or coordinates Membership, Sponsorship, Grants, Major Events, Major Corporate Sponsorship, Project Fundraising, Legacy Giving, and related fundraising activities.' },
    { t: 'h', text: 'Docent Committee (Second & Fourth Thursday – 1pm)' },
    { t: 'p', text: 'Oversees the tour program, ensuring engaging and accurate interpretation.' },
    { t: 'p', text: '**Lead:** Rich Hill' },
    { t: 'p', text: '**Responsibilities:** Trains and supports volunteers serving as docents, develops public and private tours in coordination with the History Committee, and maintains the overall tour program. Works with historical researchers to ensure information presented to visitors is accurate and appropriate. Under the current Committee Policy, the docent function is structured as a subcommittee of the History Committee rather than as a separate standing committee.' },
    { t: 'h', text: 'History Committee (Meeting Time Undetermined)' },
    { t: 'p', text: 'Leads historical research, documentation, interpretation, and preservation of information relating to North Star House, its grounds, people, and regional context.' },
    { t: 'p', text: '**Lead:** ' }, TBD,
    { t: 'p', text: '**Responsibilities:** Researches, preserves, and presents the history of North Star House and its grounds. Maintains historical records, photographs, archival materials, and inventories of historically significant information. Provides historical materials to the Docent Committee, works with Marketing and Docents to review historical information shared publicly, advises other committees on historical accuracy, and develops interpretive displays, lectures, articles, videos, and other educational materials.' },
    { t: 'p', text: '**Committee reporting:** each chair is responsible for reporting committee activities and project progress to the Board monthly. The chair also maintains/provides committee membership information, while the Board Secretary maintains the official roster of active committees.' },
  ] },
  { id: 'together', group: 'guide', title: 'How We Work Together', blocks: [
    { t: 'p', text: 'Clear communication and shared access are essential to how we operate at the North Star House. As a working board with limited staff and high volunteer involvement, we depend on organization, transparency, and teamwork to keep everything moving.' },
    { t: 'h', text: 'Who to Contact for What' },
    { t: 'table', head: ['Topic / Area', 'Contact', 'Method'], rows: [
      ['Any issues related to house supplies, cleaning needs, or general on-site upkeep.', 'Jen McGuire', 'jen@thenorthstarhouse.org · 530-575-2451'],
      ['General operations, systems, volunteers and inter-department coordination', 'Haley Wright', 'media@thenorthstarhouse.org · 530-913-6348'],
      ['First Floor Restoration', 'Rick Panos', 'papapanos1969@gmail.com · 562-208-8654'],
      ['Second Floor Construction', 'Andy Wright', 'Andy@thenorthstarhouse.org · 530-913-0377'],
      ['Garden & Grounds', 'Paula Campbell', 'paulacampbell@pacbell.net · 530-263-4113'],
      ['Submissions for board review or decisions', 'Ken Underwood', 'underwood.kenneth@gmail.com · 530-537-5051'],
      ['Budget or Finance', 'Wyn Spiller', 'wyn.spiller@gmail.com · 530-913-6470'],
      ['AV & Electrical', 'Tom Milam', 'tech@thenorthstarhouse.org · 530-263-3352'],
      ['Social media, website updates, newsletter submissions, and promotional materials', 'Haley Wright', 'media@thenorthstarhouse.org · 530-913-6348'],
      ['Rental tours, contracts, setup logistics, and venue use', 'Jen McGuire', 'jen@thenorthstarhouse.org · 530-575-2451'],
      ['Other questions', 'Ask Office', ''],
    ] },
  ] },
  { id: 'governance', group: 'guide', title: 'Governance & Decision Making', blocks: [
    { t: 'p', text: '**Voting Process:** Each board member has one vote. Decisions are approved by majority vote.' },
    { t: 'p', text: '**Decision Log:** All board decisions are recorded in the official meeting minutes, prepared by the Board Secretary. These minutes serve as the permanent decision log.' },
    { t: 'p', text: '**Submissions:** Any proposals, requests, or materials requiring board review must be submitted through the Board Secretary to ensure proper documentation and circulation.' },
    { t: 'p', text: '**Transparency:** Summaries of key decisions may be shared with staff, volunteers, or committees to maintain alignment and communication.' },
    { t: 'p', text: '**Conflict of Interest Policy:** The North Star House is committed to the highest standards of integrity, accountability, and transparency. Board members, staff, and volunteers must avoid situations where personal, financial, or professional interests conflict—or appear to conflict—with the best interests of the organization.' },
    { t: 'h', text: 'Key Guidelines' },
    { t: 'ul', items: ['Board members must disclose any actual or potential conflict of interest in writing or during a meeting.', 'Individuals with a conflict must abstain from discussion and voting on the matter.', 'Disclosures will be recorded in the meeting minutes by the Secretary.', 'Annual conflict of interest forms must be completed by all board members.'] },
  ] },
  { id: 'guidelines', group: 'guide', title: 'Volunteer & Staff Guidelines', blocks: [
    { t: 'p', text: 'The North Star House depends on the dedication of its volunteers and staff to fulfill its mission. These guidelines outline the expectations, procedures, and supports in place to ensure that everyone has a safe, rewarding, and productive experience.' },
    { t: 'h', text: 'Onboarding & Training' },
    { t: 'ul', items: ['**Staff and volunteers** complete an orientation that includes an overview of the history, mission, and values of the North Star House.', '**Training** is provided specific to roles (docenting, restoration, events, admin, etc.) and may include shadowing, written instructions, or committee-led.', '**Mentorship** is encouraged; new volunteers are paired with experienced team members when possible.'] },
    { t: 'h', text: 'Time Tracking' },
    { t: 'ul', items: ['All volunteers must sign in and out on the official tracking kiosk.', { text: 'Hours are recorded for:', sub: ['Grant reporting', 'Donor recognition', 'Organizational planning', 'Time tracking helps us recognize and ensure our records reflect the true impact of the community.'] }] },
    { t: 'h', text: 'Safety & Liability' },
    { t: 'ul', items: ['All volunteers and staff must sign a **waiver of liability** before participating in activities.', '**Emergency contact information** is collected during onboarding and kept on file.', 'Safety training (e.g., fire suppression, tool usage, first aid awareness) is offered as needed.', 'Any incident or injury must be reported immediately to staff or a board liaison.'] },
    { t: 'h', text: 'Conduct Expectations' },
    { t: 'ul', items: ['Treat all visitors, volunteers, staff, and board members with respect and professionalism.', 'Maintain honesty and transparency in all interactions.', 'Follow established procedures for opening/closing, events, and property use.', 'Uphold the mission of the North Star House by representing it positively in the community.', 'Avoid conflicts of interest or situations that could reflect poorly on the organization.'] },
    { t: 'h', text: 'Expenses & Reimbursements' },
    { t: 'ul', items: ['Receipts must be submitted within 60 days to request reimbursement.', 'Reimbursement requests are reviewed by the Treasurer and processed according to organizational policy.'] },
    { t: 'h', text: 'Opening & Closing Procedures' },
    { t: 'ul', items: ['**Opening:** Unlock main entry, turn on necessary lights & systems.', '**Closing:** Secure all doors, confirm lights & systems are off, and lock up any equipment.'] },
    { t: 'h', text: 'Recognition & Appreciation' },
    { t: 'ul', items: ['NSH tracks volunteer hours to celebrate contributions and community impact.', 'Volunteers will be invited to appreciation events and recognized publicly when appropriate.'] },
    { t: 'note', text: 'These guidelines support a respectful, historic, and community-centered environment. Together, we honor the legacy of the North Star House while building a welcoming space for all.' },
  ] },
  { id: 'pillars', group: 'guide', title: 'Core Program Pillars', blocks: [
    { t: 'p', text: 'The North Star House operates through five interconnected program areas that reflect its mission and maximize its impact.' },
    { t: 'p', text: '**History & Preservation:** Through docent-led tours, volunteer opportunities, and ongoing restoration efforts, we are committed to protecting and sharing the legacy of the North Star House. This pillar ensures the historical integrity of the site remains central to all we do.' },
    { t: 'p', text: '**Weddings & Private Events:** As our largest source of earned revenue, weddings and private rentals provide essential funding for preservation and operations. These events support our sustainability while introducing new audiences to the beauty and history of the House.' },
    { t: 'p', text: '**Community:** From public gatherings and seasonal events to lectures, shows, and civic partnerships, our community programming connects people to the House in meaningful ways. These events foster a sense of belonging and broaden our reach across generations.' },
    { t: 'p', text: '**Arts:** Workshops, classes, and collaborations with local artists and creatives make the North Star House a vibrant cultural space. This programming elevates regional talent while inviting guests to engage with the arts in a historic setting.' },
    { t: 'p', text: '**Education:** Our mentorship and internship programs offer young people hands-on opportunities to build real-world skills. Volunteers gain valuable experience and professional references, supporting both personal growth and long-term community investment in the site.' },
  ] },
  { id: 'messaging', group: 'guide', title: 'Key Messaging', blocks: [
    { t: 'note', text: 'Designed by Julia Morgan; Restored by You' },
    { t: 'p', text: 'The North Star House is more than a historic building: it is a gathering place with purpose. Designed by Julia Morgan, this estate has long stood as a symbol of creativity, community, and resilience. Today, every event, tour, and program held here supports the continued preservation of the House and helps write the next chapter of its story.' },
    { t: 'p', text: 'Our mission is rooted in honoring the past while serving the present, bringing the House to life through weddings, public events, workshops, and educational programs that generate essential revenue while strengthening our community.' },
    { t: 'p', text: 'We believe that historic spaces should be living, accessible, and relevant. That’s why we focus on creative programming, community partnerships, and real-world learning opportunities that invite people to engage, connect, and grow. Volunteers and donors are not just supporting a cause: **they are shaping a legacy.**' },
    { t: 'p', text: 'At its core, the North Star House stands as proof that preservation and progress can go hand in hand. Every restored room, every celebration, and every visitor represents a step forward.' },
    { t: 'p', text: '**Shorter Version:** The North Star House is a restored Julia Morgan–designed estate where history lives and community comes together. Through weddings, events, classes, and volunteer efforts, we keep this historic space vibrant and purposeful. Every gathering supports its preservation and ensures it remains a gathering place for generations to come.' },
  ] },
  { id: 'pillar-messaging', group: 'guide', title: 'Pillar Support – Key Messaging', blocks: [
    { t: 'h', text: 'History & Preservation' },
    { t: 'p', text: 'The North Star House is a nationally recognized historic site, and preserving it is at the heart of our mission. Through guided tours, restoration efforts, and volunteer opportunities, we honor the legacies of Julia Morgan and Mary Hallock Foote while keeping the past alive for future generations. Supporting this pillar ensures the House remains a vibrant, living testament to California’s cultural heritage.' },
    { t: 'h', text: 'Weddings & Private Events' },
    { t: 'p', text: 'Weddings and private events are our primary source of earned income and play a crucial role in restoring the North Star House. Each celebration directly supports our preservation efforts and public programs, allowing us to welcome more people through our doors. Choosing our venue means celebrating in a timeless setting while contributing to something bigger.' },
    { t: 'h', text: 'Community' },
    { t: 'p', text: 'The North Star House was built to bring people together, and today it continues that legacy through seasonal events, public gatherings, lectures, and civic partnerships. These programs foster connection across generations and create meaningful experiences for all. Community support helps us remain a welcoming, inclusive space where history and togetherness thrive.' },
    { t: 'h', text: 'Art' },
    { t: 'p', text: 'Once the home of writer and illustrator Mary Hallock Foote, the North Star House has always been a place where creativity belongs. Today, we carry that legacy forward by offering workshops, classes, and collaborations with local artists that celebrate both history and self-expression. Supporting the arts here means nurturing regional talent and honoring a tradition of storytelling, creativity, and cultural enrichment in a setting built to inspire.' },
    { t: 'h', text: 'Education' },
    { t: 'p', text: 'Our internship and mentorship programs empower youth and emerging professionals to gain real-world skills in trades, events, marketing, preservation, and more. These hands-on experiences foster confidence, curiosity, and a deep connection to community service. Supporting education at North Star House means shaping futures while sustaining our mission through the next generation.' },
  ] },
  { id: 'faq', group: 'guide', title: 'Frequently Asked Questions', blocks: [
    { t: 'faq', q: 'What is the mission of the North Star Historic Conservancy?', a: '**Mission Statement:** To restore North Star House as a cultural gathering center, bringing the magic of the arts, theater, literature, history and music to generations of children, youth, and adults as well as providing a unique environment that nourishes the creative spirit.' },
    { t: 'faq', q: 'What parts of the House are currently restored?', a: 'The first floor is largely restored and used for tours, classes, weddings, and events. The second floor remains mostly unfinished and is a current focus for restoration fundraising and strategic development. Infrastructure improvements, fire safety upgrades, and ADA accessibility projects are also underway.' },
    { t: 'faq', q: 'Is the North Star House rentable for weddings or events?', a: 'The North Star House is rentable for weddings, celebrations, and other private events. For availability, tours, and pricing, visit our website or email us directly.' },
    { t: 'faq', q: 'How is the site used during the week?', a: 'On weekdays, the House supports volunteer projects, restoration work, public tours, and creative-led rentals. This allows us to give back to the community while growing awareness and appreciation for the property’s historic and cultural value.' },
    { t: 'faq', q: 'Do you offer tours of the House?', a: 'Public tours are offered on the second and fourth Thursday of each month from 1-3pm. Private tours can also be scheduled upon request.' },
    { t: 'h', text: 'How is the House funded?' },
    { t: 'p', text: 'Funding comes from:' },
    { t: 'ul', items: ['Venue rentals', 'Individual donations', 'Membership programs', 'Grants', 'Sponsorships', 'Fundraising events', 'In-kind contributions and volunteer time'] },
    { t: 'p', text: 'Every dollar supports our preservation efforts and community programming.' },
    { t: 'h', text: 'How can I get involved?' },
    { t: 'p', text: 'There are many ways to help:' },
    { t: 'ul', items: ['Volunteer with one of our teams (docents, restoration, events, landscaping, etc)', 'Become a member and support our mission year-round', 'Attend or host an event', 'Donate or sponsor a program', 'Purchase a commemorative brick'] },
    { t: 'p', text: 'Visit our website or speak to a staff member for more details.' },
    { t: 'h', text: 'What kind of programs do you offer?' },
    { t: 'p', text: 'We host a mix of:' },
    { t: 'ul', items: ['Public tours', 'Community events', 'Arts and cultural workshops', 'Historical lectures', 'Seasonal activities'] },
    { t: 'p', text: 'We also welcome collaboration ideas from creatives, educators, and nonprofits.' },
  ] },
  { id: 'gift', group: 'guide', title: 'Gift Acceptance Protocol & Internal Intake Checklist', blocks: [
    { t: 'note', text: 'North Star House – Interiors Committee | August 2025' },
    { t: 'p', text: '**Purpose:** To ensure all offered items are received, reviewed, and responded to with transparency, gratitude, and historical appropriateness.' },
    { t: 'h', text: '1. Initial Offer of Donation' },
    { t: 'ul', items: ['Any team member receiving a donation offer (verbal or written) refers the donor to the Interiors Lead or designated intake contact.', { text: 'Interiors Lead shall provide donor with a standardized Gift Inquiry Form to outline:', sub: ['Item description and photos', 'Known provenance or historical background', 'Any donor preferences (display, acknowledgement, return if unused)', 'Timeline for response or transfer'] }] },
    { t: 'h', text: '2. Acknowledgment & Response Timeline' },
    { t: 'ul', items: ['Interiors Lead sends acknowledgment via email within 3 business days of receiving completed form.', 'Committee meets (or conducts email review) to assess within 2 weeks, barring urgent items.', 'A formal decision (acceptance or decline) must be communicated to the donor within 30 days.'] },
    { t: 'h', text: '3. Review & Approval Process' },
    { t: 'ul', items: [{ text: '**Interior Committee evaluates based on:**', sub: ['Historical relevance or stylistic compatibility', 'Condition and feasibility of restoration, if needed', 'Storage or display capacity; Where or how will it be used?', 'Long-term significance or alignment with current priorities'] }, { text: '**If approved:**', sub: ['Formal acceptance letter sent to donor, including any terms (e.g., placement, acknowledgment)', 'If high level donor, letter should come from BOD or President', 'Documentation filed for committee and Board records'] }, { text: '**If declined:**', sub: ['A respectful Decline Letter will be sent with a thoughtful explanation'] }] },
    { t: 'p', text: '**All accepted or declined offers will be documented and summarized in the Interiors Committee’s monthly report to the Board.**' },
    { t: 'h', text: 'Internal Intake Checklist' },
    { t: 'p', text: '**Donated Item:**' },
    { t: 'h', text: 'Upon Receipt of Inquiry' },
    { t: 'check', items: ['Confirm donor completed all required fields', 'Verify attached photos—if not provided, request before proceeding', 'Log date of submission', 'Acknowledge receipt (within 3 business days)', 'Assign to Interiors Lead (or designated reviewer)', 'If a high-level donor, notify Board of Directors immediately'] },
    { t: 'h', text: 'Review Process' },
    { t: 'check', items: ['Schedule or initiate committee assessment', { text: 'Confirm historical relevance or stylistic compatibility', sub: ['Check authenticity and verify stated value against researched value'] }, 'Evaluate condition and restoration feasibility', { text: 'Assess storage and display capacity', sub: ['Where and how can item be used?'] }, { text: 'Cross-check donor wishes or conditions', sub: ['OK to sell or donate or return to donor?'] }] },
    { t: 'h', text: 'Follow-Up Actions' },
    { t: 'check', items: [{ text: 'Communicate formal decision within 30 days', sub: ['Acceptance letter sent', 'Decline letter sent'] }, 'Compare supplied photos to in-person inspection', 'Coordination of pickup and/or delivery if accepted', 'Catalog and photograph item for records', 'Acknowledge donor in newsletter (if permission granted)', 'File record for committee and archival use'] },
    { t: 'note', text: 'If a high level donor, acceptance or rejection letter should come from the BOD president.' },
    { t: 'h', text: 'Acceptance Letter' },
    { t: 'quote', paras: ['Dear [Donor Name],', 'On behalf of the North Star House Interiors Committee, I extend our sincere appreciation for your offer of [item(s)]. Following careful review, we are pleased to formally accept this generous donation, which reflects a meaningful contribution to the ongoing preservation and interpretation of the House.', 'We recognize the historical and aesthetic significance of your gift and are committed to stewarding it with the respect it deserves. A member of our team will be in touch to coordinate logistical details regarding receipt and documentation.', 'Your generosity will be acknowledged in our forthcoming communications with the Board and broader community, and the item(s) will be cataloged as part of our archival record.'] },
    { t: 'h', text: 'Denial Letter' },
    { t: 'quote', paras: ['Dear [Donor Name],', 'Thank you for your kind offer of [item(s)] to the North Star House. We are genuinely grateful for your thoughtfulness and the interest you have shown in supporting our preservation efforts.', 'After thorough consideration by the Interiors Committee, we regret to inform you that we are unable to accept the item(s) at this time. This decision reflects alignment with our current interpretive goals and capacity constraints, and in no way diminishes our appreciation for your generosity.', 'We remain deeply grateful for your support of the House and hope you will continue to engage with our work in the future. Should circumstances change, we welcome future correspondence.'] },
  ] },
  { id: 'coming', group: 'guide', title: 'Coming Soon', blocks: [
    { t: 'p', text: 'Still to be written:' },
    { t: 'arrows', items: [['Official By-Laws', 'Board'], ['Official Code of Conduct', 'Board'], ['Executive Committee Job Descriptions', 'Board'], ['Committee Lead Job Descriptions', 'Board'], ['Staff Job Descriptions', 'Staff / Board'], ['Onboarding Process for Each Committee', 'Committee leads'], ['Master Plan for House & Grounds', 'Board'], ['Recognition & Benefit Tiers for Volunteers', 'Board'], ['Safety & Emergency Procedures', ''], ['“Where to Find Things” (storage, signage, tools, supplies, etc.)', ''], ['Emergency Services Contact List (plumbing, electrical, pests, etc.)', ''], ['Technology & Equipment Guide (Wi-Fi, sound system, projector, etc.)', ''], ['Digital Resources', '']] },
  ] },

  // ---- Forms ----
  { id: 'f-volunteer', group: 'form', title: 'Volunteer Intake Form', blocks: [
    { t: 'h', text: 'Personal Information' }, { t: 'fields', items: ['Full Name', 'Phone Number', 'Email', 'Address', 'Date of Birth'] },
    { t: 'h', text: 'Emergency Contact Information' }, { t: 'fields', items: ['Primary Contact Name', 'Relationship', 'Phone Number'] },
    { t: 'h', text: 'Medical Information (Optional but Recommended)' }, { t: 'fields', items: ['Do you have any medical conditions we should be aware of? (e.g., asthma, diabetes, epilepsy)', 'Are you allergic to any medications or substances?', 'Do you require any special accommodations?'] },
    { t: 'note', text: 'For Office Use Only: Received by ____ · Processed Date ____' },
  ] },
  { id: 'f-waiver', group: 'form', title: 'Waiver & Release of Liability', blocks: [
    { t: 'note', text: 'North Star Historic Conservancy · P.O Box 1538, Grass Valley, CA 95945 · www.NorthStarHouse.org · 530-477-7126' },
    { t: 'p', text: 'Thank you for your generosity and willingness to volunteer at North Star Historic Conservancy! Your efforts help preserve history and create a welcoming space for the community. While we take every precaution to ensure a safe environment, we recognize that some volunteer activities may involve physical tasks, the use of tools or equipment, and outdoor conditions.' },
    { t: 'p', text: '**Waiver and Release of Liability:** By signing below, I acknowledge that I am voluntarily participating in these activities and accept responsibility for any risks, injuries, or damages that may arise. I understand that North Star Historic Conservancy, its directors, employees, and affiliates cannot be held liable for any accidents, injuries, illnesses, losses, or damages that may occur while volunteering. I release and discharge North Star Historic Conservancy from any and all claims, liabilities, or demands related to my volunteer work.' },
    { t: 'p', text: '**Medical Treatment Authorization:** In the unlikely event of an emergency, I authorize North Star Historic Conservancy representatives to provide or seek necessary medical care on my behalf if I am unable to do so myself. I understand that I am responsible for any associated medical costs.' },
    { t: 'p', text: '**Photo and Media Release:** I grant North Star Historic Conservancy permission to use photos or videos that include my image for promotional, educational, and historical documentation purposes.' },
    { t: 'p', text: '**Acknowledgment and Signature:** I have read and understand this waiver and release of liability and agree to its terms. I sign this document willingly and acknowledge its legal significance.' },
    { t: 'fields', items: ['Signature', 'Date', 'Printed Name'] },
  ] },
  { id: 'f-incident', group: 'form', title: 'Incident Report', blocks: [
    { t: 'fields', items: ['Name', 'Date', 'Individuals Involved (if applicable)', 'Date / Time of Incident', 'Location of Incident', 'Description of Incident (Please describe what happened in as much detail as possible)', 'Were there witnesses? Yes / No', 'List Names'] },
    { t: 'h', text: 'Requested Follow-Up (optional)' }, { t: 'check', items: ['No follow-up needed', 'Please forward to the Board', 'Please forward to Committee Lead', 'Other: ____'] },
  ] },
  { id: 'f-gift', group: 'form', title: 'Gift Inquiry Form', blocks: [
    { t: 'note', text: 'Donor Information & Gift Details' },
    { t: 'fields', items: ['Donor Name', 'Contact Info', 'Date of Offer', 'Item(s) Being Offered', 'Known History or Provenance (Origin, prior owners, connection to North Star House)', 'Preferred Timeline for Response or Transfer', 'Special Considerations or Wishes (Display preferences, acknowledgments, etc.)', 'Permission to acknowledge gift publicly? Yes / No', 'If the item is later unused, would you prefer it be: Returned to you / Donated or sold at our discretion', 'Any Additional Notes', 'Signature'] },
  ] },
  { id: 'f-board', group: 'form', title: 'Submission to Board Form', blocks: [
    { t: 'note', text: 'North Star House – Board Submission Form' },
    { t: 'fields', items: ['Submission Topic', 'Description', 'Supporting People or Organizations'] },
    { t: 'h', text: 'This idea includes… (check all that apply)' }, { t: 'check', items: ['Outside vendors or business connections', 'Selling goods or services', 'An event open to the public', 'Use of the house or grounds', 'Volunteers or staff time', 'NSH supplies, equipment, or marketing support', 'Other'] },
    { t: 'fields', items: ['Requested Location or Date (if any)', 'Are There Any Costs or Income Involved?'] },
    { t: 'h', text: 'What Do You Need from the Board?' }, { t: 'check', items: ['Approval to move forward', 'Feedback or suggestions', 'Just sharing the idea (no action needed)', 'Other'] },
  ] },
  { id: 'f-reimb', group: 'form', title: 'Reimbursement Form', blocks: [
    { t: 'note', text: 'North Star House Reimbursement Form · Attach itemized receipts. Receipts must be submitted within 60 days.' },
    { t: 'fields', items: ['Name', 'Date', 'List expenses: Description and Amount (seven lines)', 'TOTAL', 'Signature'] },
  ] },
  { id: 'f-inkind-sponsor', group: 'form', title: 'In-Kind Sponsorship Documentation Form', blocks: [
    { t: 'fields', items: ['Sponsor Name', 'Main Contact', 'Phone Number', 'Email Address', 'Mailing Address', 'In-Kind Donation Description', 'Estimated Fair Market Value', 'Area Supported (e.g restoration, events, interiors, grounds, etc)', 'Date Received', 'NSH Contact', 'Sponsor Level / Benefits', 'Acknowledgment Letter Sent: Yes / No  Date'] },
  ] },
  { id: 'f-sponsor', group: 'form', title: 'Sponsorship Documentation Form', blocks: [
    { t: 'fields', items: ['Sponsor Name', 'Main Contact', 'Phone Number', 'Email Address', 'Mailing Address', 'NSH Contact', 'Donation Amount', 'Date Received', 'Sponsor Level / Benefits', 'Acknowledgment Letter Sent: Yes / No  Date'] },
  ] },
  { id: 'f-inkind-work', group: 'form', title: 'In-Kind Work & Materials Donation Form', blocks: [
    { t: 'note', text: 'Titled “In-Kind Donation Documentation Form” on the printed copy.' },
    { t: 'fields', items: ['Name', 'In-Kind Donation Description', 'Estimated Fair Market Value', 'Area Supported (e.g restoration, events, interiors, grounds, etc)', 'Date Given', 'Acknowledgment Letter Sent: Yes / No  Date'] },
  ] },
  { id: 'f-creative', group: 'form', title: 'Creative Rentals Inquiry Form', blocks: [
    { t: 'note', text: 'Bring your creativity to life - become part of the programs shaping our community.' },
    { t: 'fields', items: ['Name', 'Email', 'Phone Number', 'Business / Class / Creative Area', 'Description'] },
    { t: 'h', text: 'This would include… (check all that apply)' }, { t: 'check', items: ['Materials that may leave impact or require special cleanup (paint, debris, stains, etc.)', 'Strong smells or fumes', 'Tools or equipment requiring electricity', 'Alcohol (day use permit required)', 'Large equipment or setups', 'Use of sinks or water access', 'NSH supplies or equipment (tables, chairs, support)'] },
    { t: 'fields', items: ['Please explain anything checked', 'Are you interested in our Creative Rental Volunteer Exchange Program? (16 volunteer hours in exchange for a 2-hour weekday rental slot - Monday or Wednesday) Yes / No'] },
    { t: 'h', text: 'Areas of interest for volunteering' }, { t: 'check', items: ['Restoration', 'Landscaping', 'Events', 'Docent Tours', 'Maintenance', 'Fundraising', 'Grants', 'Admin / Office', 'Wherever Needed'] },
  ] },
  { id: 'f-brick', group: 'form', title: 'Brick Order Form', blocks: [
    { t: 'note', text: 'Help Us Bring History Back to Life - Brick by Brick' },
    { t: 'p', text: 'North Star House stands as a testament to resilience, vision, and community spirit in Nevada County. Designed in 1905 by the legendary architect Julia Morgan, the house was more than just a home: it was a gathering space and a beacon of innovation. For decades, North Star House thrived and was a vital part of local culture. But time was not kind to this historic treasure.' },
    { t: 'p', text: 'As mining declined and ownership changed hands, North Star House fell into neglect. For years, the house stood on the brink of destruction. But where some saw decay, others saw potential. A dedicated group of local volunteers rallied to save North Star House, igniting a movement to restore it to its former glory. Today, it once again serves as a place where history is honored, creativity is nurtured, and community thrives. East Lawn, Courtyard, and Circular Drive — transforming these spaces into vibrant areas for community gatherings and celebration. **Now, we invite you to be part of its next chapter.**' },
    { t: 'p', text: '**Become a Part of North Star House History by purchasing a custom-engraved brick.** Your brick will be set in stone and proudly displayed on-site as a tribute to your support.' },
    { t: 'h', text: 'Choose Your Legacy Brick' },
    { t: 'p', text: 'Honor a loved one, celebrate a milestone, or simply show your support for the future of the North Star House.' },
    { t: 'ul', items: ['4” x 8” Brick – $300 donation (includes up to 3 lines of custom text)', '8” x 8” Brick – $1,000 donation (includes up to 6 lines of custom text)', '1” x 3” Mini Replica Brick – $15', '3” x 3” Mini Replica Brick – $20 (replica bricks may only be purchased with purchase of a full-size brick)'] },
    { t: 'p', text: '**To Order:** Visit NorthStarHouse.org/support or scan the QR Code or fill out the order form. Please mail the completed order and check to: The North Star Historic Conservancy at P.O Box 1538, Grass Valley, CA 95945.' },
    { t: 'h', text: 'Order form' },
    { t: 'fields', items: ['Name', 'Telephone', 'E-mail', 'Address', 'City, State, Zip', 'Your Engraved Message – 3 lines of text, 20 characters per line (including spaces and punctuation). Lines 4–6 are for 8” x 8” bricks only.'] },
  ] },
];

// ---- search + rendering helpers ----
const strip = (s) => String(s || '').replace(/\*\*/g, '');
function blockText(b) {
  switch (b.t) {
    case 'p': case 'h': case 'note': return strip(b.text);
    case 'ul': case 'check': return flatItems(b.items).join(' ');
    case 'fields': return b.items.join(' ');
    case 'table': return b.head.join(' ') + ' ' + b.rows.map(r => r.join(' ')).join(' ');
    case 'role': return b.name + ' ' + b.fields.join(' ');
    case 'faq': return b.q + ' ' + strip(b.a);
    case 'quote': return b.paras.join(' ');
    case 'arrows': return b.items.map(i => i.join(' ')).join(' ');
    case 'tbd': return 'to be completed';
    default: return '';
  }
}
function flatItems(items) { return (items || []).flatMap(i => typeof i === 'string' ? [strip(i)] : [strip(i.text), ...flatItems(i.sub)]); }
const sectionText = (s) => (s.title + ' ' + s.blocks.map(blockText).join(' ')).toLowerCase();

function Hl({ text, q }) {
  const s = String(text == null ? '' : text);
  if (!q) return <>{s}</>;
  const parts = s.split(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'));
  return <>{parts.map((p, i) => i % 2 ? <mark key={i} style={{ background: '#f6e3a8', color: 'inherit', padding: 0, borderRadius: 2 }}>{p}</mark> : p)}</>;
}
// **bold** inline
function Rich({ text, q }) {
  const parts = String(text || '').split(/\*\*(.+?)\*\*/g);
  return <>{parts.map((p, i) => i % 2 ? <strong key={i}><Hl text={p} q={q} /></strong> : <Hl key={i} text={p} q={q} />)}</>;
}
const para = { margin: '0 0 12px', fontSize: 16.5, lineHeight: 1.65, color: '#33302b' };
const tbdStyle = { display: 'inline-block', color: '#a89f8e', fontStyle: 'italic', fontSize: 13, background: '#f6f1e8', borderRadius: 5, padding: '1px 8px', margin: '0 0 12px' };

function Items({ items, q, box, level = 0 }) {
  return <ul style={{ margin: level ? '4px 0 4px' : '0 0 14px', paddingLeft: level ? 22 : 4, listStyle: 'none' }}>
    {items.map((it, i) => {
      const text = typeof it === 'string' ? it : it.text, sub = typeof it === 'string' ? null : it.sub;
      return <li key={i} style={{ fontSize: 16.5, lineHeight: 1.6, color: '#33302b', margin: '3px 0', display: 'flex', gap: 9, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ color: GOLD, flexShrink: 0, fontSize: box ? 13 : 9 }}>{box ? '☐' : level ? '○' : '●'}</span>
        <span style={{ flex: 1, minWidth: 0 }}><Rich text={text} q={q} />{sub && <Items items={sub} q={q} box={box} level={level + 1} />}</span>
      </li>;
    })}
  </ul>;
}

function Block({ b, q }) {
  switch (b.t) {
    case 'p': return <p style={para}><Rich text={b.text} q={q} /></p>;
    case 'h': return <h3 style={{ margin: '20px 0 8px', fontSize: 18, fontFamily: SERIF, color: '#1f1c18', fontWeight: 700 }}><Hl text={b.text} q={q} /></h3>;
    case 'note': return <p style={{ ...para, fontStyle: 'italic', color: '#6b6355' }}><Rich text={b.text} q={q} /></p>;
    case 'tbd': return <div><span style={tbdStyle}>To be completed</span></div>;
    case 'ul': return <Items items={b.items} q={q} />;
    case 'check': return <Items items={b.items} q={q} box />;
    case 'fields': return <div style={{ margin: '0 0 14px', border: '1px solid #ece5d8', borderRadius: 8, overflow: 'hidden' }}>
      {b.items.map((f, i) => <div key={i} style={{ padding: '8px 12px', fontSize: 15.5, color: '#4a453e', borderTop: i ? '1px solid #f1ebdf' : 'none', background: i % 2 ? '#fdfbf7' : '#fff' }}><Hl text={f} q={q} /></div>)}
    </div>;
    case 'role': return <div style={{ margin: '10px 0 14px 4px', paddingLeft: 12, borderLeft: '3px solid #e6dcc6' }}>
      <div style={{ fontWeight: 700, fontSize: 16, color: '#1f1c18', fontFamily: SERIF }}><Hl text={b.name} q={q} /></div>
      {b.fields.map((f, i) => <div key={i} style={{ fontSize: 15.5, color: '#6b6355', margin: '3px 0 0' }}><strong style={{ fontWeight: 600 }}><Hl text={f} q={q} />:</strong> <span style={{ color: '#a89f8e', fontStyle: 'italic', fontSize: 13 }}>to be completed</span></div>)}
    </div>;
    case 'faq': return <div style={{ margin: '0 0 16px' }}>
      <div style={{ fontWeight: 700, fontSize: 16.5, fontFamily: SERIF, color: '#1f1c18', marginBottom: 4 }}><Hl text={b.q} q={q} /></div>
      <div style={{ ...para, display: 'flex', gap: 9, margin: 0 }}><span style={{ color: GOLD }}>★</span><span><Rich text={b.a} q={q} /></span></div>
    </div>;
    case 'quote': return <div style={{ margin: '0 0 14px', padding: '4px 16px', background: '#fbf8f2', borderLeft: '3px solid #e6dcc6', borderRadius: 4 }}>{b.paras.map((p, i) => <p key={i} style={para}><Hl text={p} q={q} /></p>)}</div>;
    case 'arrows': return <ul style={{ margin: '0 0 14px', padding: 0, listStyle: 'none' }}>{b.items.map((it, i) => <li key={i} style={{ fontSize: 16.5, lineHeight: 1.6, color: '#33302b', margin: '3px 0', display: 'flex', gap: 9 }}><span style={{ color: GOLD }}>➔</span><span><Hl text={it[0]} q={q} />{it[1] && <em style={{ color: '#8a8272' }}> ({it[1]})</em>}</span></li>)}</ul>;
    case 'table': return <div style={{ overflowX: 'auto', margin: '0 0 14px' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15.5 }}>
      <thead><tr>{b.head.map((h, i) => <th key={i} style={{ textAlign: 'left', padding: '8px 10px', background: '#f6f1e8', border: '1px solid #e6dcc6', color: '#4a3b24' }}>{h}</th>)}</tr></thead>
      <tbody>{b.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={{ padding: '8px 10px', border: '1px solid #ece5d8', verticalAlign: 'top', color: '#33302b' }}><Hl text={c} q={q} /></td>)}</tr>)}</tbody>
    </table></div>;
    default: return null;
  }
}

export function OrgGuideView() {
  const [query, setQuery] = React.useState('');
  const [wide, setWide] = React.useState(typeof window === 'undefined' ? true : window.innerWidth >= 820);
  const scrollRef = React.useRef(null);
  React.useEffect(() => { const f = () => setWide(window.innerWidth >= 820); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  const q = query.trim();
  const texts = React.useMemo(() => Object.fromEntries(GUIDE.map(s => [s.id, sectionText(s)])), []);
  const shown = q ? GUIDE.filter(s => texts[s.id].includes(q.toLowerCase())) : GUIDE;
  const hits = (s) => q ? (texts[s.id].split(q.toLowerCase()).length - 1) : 0;
  function jump(id) {
    const box = scrollRef.current, el = document.getElementById('og-' + id);
    if (box && el) box.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' });
  }
  const guideShown = shown.filter(s => s.group === 'guide'), formShown = shown.filter(s => s.group === 'form');
  const tocBtn = (s) => <button key={s.id} type="button" onClick={() => jump(s.id)} style={{ display: 'flex', width: '100%', alignItems: 'baseline', gap: 6, textAlign: 'left', background: 'none', border: 'none', borderRadius: 6, padding: '6px 8px', fontSize: 13, color: '#4a453e', cursor: 'pointer', lineHeight: 1.35 }}
    onMouseEnter={e => { e.currentTarget.style.background = '#f6f1e8'; }} onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
    <span style={{ flex: 1 }}>{s.title}</span>{q && <span style={{ fontSize: 11, color: GOLD, fontWeight: 700 }}>{hits(s)}</span>}
  </button>;
  // Timeline layout: a gold pill with the section number, a slim gold line running down through the pills, a dotted gold
  // line out to the section's title and text.
  const card = (s, n, list) => <section key={s.id} id={'og-' + s.id} style={{ display: 'flex', gap: 0, fontFamily: SERIF, position: 'relative' }}>
    <div style={{ width: 92, flexShrink: 0, position: 'relative' }}>
      {n < list.length - 1 && <div style={{ position: 'absolute', left: 34, top: 40, bottom: -2, borderLeft: '1px solid ' + GOLD, opacity: .55 }} />}
      <div style={{ position: 'relative', zIndex: 1, width: 68, height: 38, borderRadius: 19, background: GOLD, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, marginTop: 4 }}>{n + 1}</div>
      <div style={{ position: 'absolute', left: 68, right: 8, top: 23, borderTop: '1px dotted ' + GOLD }} />
      <div style={{ position: 'absolute', right: 3, top: 20, width: 7, height: 7, borderRadius: '50%', background: GOLD }} />
    </div>
    <div style={{ flex: 1, minWidth: 0, padding: '0 0 30px 6px' }}>
      <h2 style={{ margin: '4px 0 10px', fontFamily: SERIF, fontSize: 24, fontWeight: 700, color: GOLD }}><Hl text={s.title} q={q} /></h2>
      {s.blocks.map((b, i) => <Block key={i} b={b} q={q} />)}
    </div>
  </section>;
  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '11px 38px 11px 14px', border: '1px solid #ded7cb', borderRadius: 10, fontSize: 14, background: '#fff', fontFamily: 'inherit' };
  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ position: 'relative', marginBottom: 6 }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search the guide: committees, contacts, policies, forms…" style={inputStyle} />
        {query && <button type="button" onClick={() => setQuery('')} title="Clear search" style={{ position: 'absolute', right: 8, top: 7, background: 'none', border: 'none', fontSize: 18, color: '#999', cursor: 'pointer', padding: '2px 8px' }}>×</button>}
      </div>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>{q ? (shown.length ? shown.length + ' section' + (shown.length === 1 ? '' : 's') + ' match “' + q + '”' : 'No sections match “' + q + '”') : 'North Star House Overview & Organizational Guide. Scroll, or pick a section.'}</div>
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        {wide && <nav aria-label="Guide sections" style={{ width: 250, flexShrink: 0, position: 'sticky', top: 0, maxHeight: 'calc(100vh - 210px)', overflowY: 'auto', background: '#fff', border: '0.5px solid #e8e0d5', borderRadius: 12, padding: '10px 8px' }}>
          {guideShown.length > 0 && <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 1, padding: '4px 8px' }}>Guide</div>}
          {guideShown.map(tocBtn)}
          {formShown.length > 0 && <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 1, padding: '12px 8px 4px' }}>Forms</div>}
          {formShown.map(tocBtn)}
        </nav>}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!wide && shown.length > 0 && <select value="" onChange={e => { if (e.target.value) jump(e.target.value); }} style={{ ...inputStyle, padding: '9px 12px', marginBottom: 12 }}>
            <option value="">Jump to a section…</option>{shown.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>}
          <div ref={scrollRef} style={{ position: 'relative', height: 'calc(100vh - 210px)', minHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
            {shown.length === 0 ? <div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 14 }}>Nothing in the guide matches. Try a shorter word.</div> : <>
              {guideShown.map((s, n) => card(s, n, guideShown))}
              {formShown.length > 0 && <div style={{ fontFamily: SERIF, fontSize: 30, color: GOLD, textAlign: 'center', margin: '26px 0 6px', borderTop: '1px solid #cfc6b8', borderBottom: '1px solid #cfc6b8', padding: '14px 0' }}>Forms</div>}
              {formShown.length > 0 && <div style={{ fontSize: 12.5, color: '#888', textAlign: 'center', marginBottom: 18 }}>Fill-in copies to print are in Admin → Printable Forms.</div>}
              {formShown.map((s, n) => card(s, n, formShown))}
            </>}
          </div>
        </div>
      </div>
    </div>
  );
}
