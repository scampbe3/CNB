// Final supplied copy. Existing section names and page keys remain integration identifiers.
export const homeDir = 'HOME PAGE PHOTOS/';
export const consultingDir = 'CONSULTING PAGE PHOTOS/';
export const speakingDir = 'SPEAKING & EDUCATION/';
export const dinnerDir = 'THE BLIND DINNER/';
export const decisionDir = 'THE DECISION ROOM/';
const image = (source, alt, fit = 'contain') => ({ source, alt, fit });
const cta = (label, href, variant = 'primary') => ({ label, href, variant });
const section = (name, order, content, extra = {}) => ({ name, order, ...content, ...extra });
const custom = (name, order, content, layout = 'Image Right') => section(name, order, content, { custom: true, layout });

const john = { title: 'John McCourt', quote: 'I am the executive I am today because she taught me how to think.', attribution: 'John McCourt, Senior Vice President, Social Impact, Weber Shandwick', image: image(homeDir + 'John McCourt.webp', 'John McCourt') };
const ashley = { title: 'Ashley Tsai', quote: 'Amanda was a partner in transformation.', attribution: 'Ashley Tsai, Managing Director, Analytics, mSix&Partners (now T&Pm, WPP)', image: image(homeDir + 'Ashley Tsai.jfif', 'Ashley Tsai') };
const monique = { title: 'Monique Kofsky', quote: "She has the same level of care and dedication that I would expect from myself. With Amanda, it's almost as if the business is hers too.", attribution: 'Monique Kofsky, Founder & CEO, Butter & Lye', image: image(homeDir + 'Monique Kofsky.webp', 'Monique Kofsky') };
const experience = [
  ['Engineering', '...how to solve problems.', 'Engineering taught me to break complexity into manageable parts, think systematically and build solutions that last.', 'Cornell graduation photo.jpg', 'Amanda at her Cornell graduation'],
  ['Television', '...how to stay calm under pressure.', 'In the newsroom, every deadline mattered. I learned to make decisions quickly, earn trust under pressure and tell stories that informed millions.', 'NBC anchor desk photo.jpg', 'Amanda at the NBC anchor desk'],
  ['Publishing', '...that stories shape culture.', 'Working in magazine publishing showed me how ideas influence conversations, build communities and inspire people to act.', 'Out100 Barack Obama cover.jpg', 'Out100 magazine cover featuring Barack Obama'],
  ['Global marketing', '...how ideas scale.', 'Leading global marketing initiatives taught me how to build brands across countries, cultures and audiences without losing what makes them meaningful.', 'Amanda on stage global.png', 'Amanda speaking on a global stage'],
  ['Consulting', '...that the best answers begin with better questions.', "My job isn't to have all the solutions. It's to uncover what's getting in the way, challenge assumptions and help leaders move forward with clarity and confidence.", 'Amanda consulting.jpg', 'Amanda consulting'],
  ['Entrepreneurship', '...that ownership changes everything.', 'Building a bootstrapped company taught me to embrace uncertainty, make decisions with limited resources and create opportunities instead of waiting for them.', 'Amanda Entrepreneurship photo.JPEG', 'Amanda as an entrepreneur'],
  ['Teaching', "...that the goal isn't to have all the answers.", "The best educators don't simply share knowledge. They help people develop the judgment, confidence and curiosity to think for themselves.", 'Amanda on stage and panel.JPEG', 'Amanda speaking on a panel'],
];
const engagements = [
  ['American Express', 'Building cultural relevance through authentic storytelling.', '#ExpressYourSelfie campaign during Pride.', 'American Express Pride Parade.png'],
  ['Out100 Gala', 'Transforming an awards show into a year-round marketing platform.', '$2.5M+ in advertising and sponsorship revenue.', 'Out100Gala Main.jpg'],
  ['Matrix Professional', 'Leading digital transformation across more than 40 countries.', 'Global strategy. Local execution.', 'Matrix Main Photo.png'],
  ['Blooming Haus', 'Helping the founders become the face of a global luxury brand.', 'Fractional Chief Marketing Officer.', 'Blooming Haus MAIN.png'],
  ['Biolage RAW', "Launching a new brand inside one of beauty's most iconic portfolios.", 'Global launch strategy and campaign development.', 'Biolage RAW MAIN.png'],
  ['Gilead Sciences', 'Turning complex healthcare topics into human stories.', 'Documentary-style branded content.', 'Gilead MAIN.png'],
  ['Butter & Lye', 'Building a premium brand from the ground up.', 'Brand strategy, positioning and transformation.', 'Butter & Lye MAIN.png'],
  ['Upstream', 'Keeping an industry moving forward during a global shutdown.', 'Virtual event strategy during COVID-19.', 'Upstream MAIN.jpg'],
];
export const downloads = [
  [consultingDir + 'Amanda Johnson Executive Curriculum Vitae Consulting.pdf', 'amanda-johnson-consulting-cv.pdf'],
  [speakingDir + 'Amanda Johnson Executive Curriculum Vitae EDUCATION.pdf', 'amanda-johnson-education-cv.pdf'],
  [speakingDir + 'Amanda Johnson Teaching Philosophy.pdf', 'amanda-johnson-teaching-philosophy.pdf'],
];
const pdf = name => `https://cdn.jsdelivr.net/gh/scampbe3/CNB@main/assets/docs/phase1a/${name}`;

export const pages = [
  { key: 'homepage', sections: [
    section('Hero', 10, { note: 'Amanda Johnson.', title: 'People pay me to tell them the truth.', body: ["I've spent more than two decades helping leaders make better decisions. My career has taken me from television newsrooms to magazine publishing, global brands, entrepreneurship and higher education. Every chapter has shaped how I solve problems, ask better questions and help others navigate complexity."], image: image(homeDir + 'Amanda Johnson Hero Home Page.jpg', 'Amanda Johnson', 'cover') }),
    custom('Selected Experience', 20, { title: 'Selected Experience', body: ['Every chapter changed the way I think about business. Today, I bring those perspectives together to help leaders make better decisions.'] }, 'Text Only'),
    ...experience.map(([area, title, body, photo, alt], i) => (i === 0 ? section : custom)(i === 0 ? 'The Decision Room' : `Experience - ${area}`, 21 + i, { eyebrow: `${area} taught me...`, title, body: [body], image: image(homeDir + photo, alt) })),
    custom('Testimonials', 30, { title: "The people I've worked with say it best." }, 'Text Only'),
    custom('Testimonial - John', 31, john, 'Image Left'),
    custom('Testimonial - Ashley', 32, ashley),
    custom('Testimonial - Monique', 33, monique, 'Image Left'),
    section('Business Counsel', 40, { eyebrow: 'Consulting', title: 'Executive strategy for organizations navigating change.', body: ['Fractional Chief Marketing Officer. Marketing transformation. Strategic advisory.', 'When the next decision matters most.'], ctas: [cta('Explore Consulting', '/work-with-amanda')], image: image(homeDir + 'Amanda Main Consulting Shot.jpg', 'Amanda Johnson consulting') }),
    section('Strategic Partnership', 50, { eyebrow: 'Speaking & Education', title: 'Preparing people for the decisions that matter.', body: ["Business is more than a career. It's a way of thinking. It's a framework for solving problems, recognizing opportunities and building a life with intention."], ctas: [cta('Explore Speaking & Education', '/speaking-education')], image: image(homeDir + 'Amanda Speaking & Education Main.JPG', 'Amanda speaking to an audience') }),
    section('Case Studies', 60, { eyebrow: 'Library', title: 'My thinking, in writing.', body: ['Essays, AI prompts, decision briefs and business cases for people who believe better questions lead to better decisions.'], ctas: [cta('Explore the Library', '/learn')], image: image(homeDir + 'Amanda Johnson Library.jpg', 'Amanda Johnson in the Library') }),
    section('Blind Dinners', 70, { eyebrow: 'The Blind Dinner', title: "We didn't ask for a seat at the table.", body: ['We built our own.'], ctas: [cta('Discover The Blind Dinner', '/blind-dinners')], image: image(homeDir + 'The Blind Dinner Main Photo.jpeg', 'Guests gathered at The Blind Dinner') }),
  ] },
  { key: 'work-with-amanda', sections: [
    section('hero', 10, { note: 'Consulting', title: 'Executive strategy for organizations navigating change.', subhead: 'Fractional Chief Marketing Officer \u2022 Marketing Transformation \u2022 Strategic Advisory', ctas: [cta('Download CV', pdf('amanda-johnson-consulting-cv.pdf'))], image: image(consultingDir + 'Amanda Consulting MAIN.jpg', 'Amanda Johnson', 'cover') }),
    section('closing', 20, { eyebrow: '', title: 'Selected Engagements', body: ['A selection of work spanning media, healthcare, technology, beauty and consumer brands.'] }),
    ...engagements.map(([name, title, body, photo], i) => (i < 3 ? section : custom)(['business-counsel', 'strategic-partnership', 'from-clients'][i] || `Engagement - ${name}`, 30 + i, { eyebrow: name, title, body: [body], image: image(consultingDir + photo, `${name} selected engagement`) })),
  ] },
  { key: 'speaking-education', newPage: true, sections: [
    section('hero', 10, { note: 'Speaking & Education', title: 'Preparing people for the decisions that matter.', body: ["Business is more than a career. It's a framework for solving problems, recognizing opportunities and building a life with intention."], ctas: [cta('Download CV', pdf('amanda-johnson-education-cv.pdf')), cta('Download Teaching Philosophy', pdf('amanda-johnson-teaching-philosophy.pdf'), 'ghost')] }),
    custom('Teaching Philosophy', 20, { title: 'Teaching Philosophy', body: ["In an age where information is abundant and AI can generate answers in seconds, I believe the greatest competitive advantage isn't knowing more. It's developing the judgment to ask better questions, recognize opportunities and make thoughtful decisions.", "Whether I'm teaching university students, facilitating executive workshops or speaking at conferences, my goal is to connect theory with practice through discussion, current events and real-world business cases."], image: image(speakingDir + 'Amanda Speaking Education MAIN.png', 'Amanda speaking on stage') }),
    custom('Speaking Topics', 30, { title: 'Speaking Topics', list: ['Artificial Intelligence', 'Marketing Strategy', 'Brand Strategy', 'Strategic Decision-Making', 'Entrepreneurship', 'Executive Leadership', 'Journalism & Media', 'Storytelling & Communications'] }, 'Text Only'),
    custom('What People Say', 40, { title: 'What People Say' }, 'Text Only'),
    custom('Testimonial - John', 41, john, 'Image Left'),
    custom('Testimonial - Leon', 42, { title: 'Leon Wiles', quote: 'Amanda has the unique ability to connect academic concepts with real-world business experience, helping students understand not just what works, but why it works.', attribution: 'Leon Wiles, Educational Consultant; Former Chief Diversity Officer, Clemson University; Former Vice Chancellor for Student & Diversity Affairs, University of South Carolina Upstate', image: image(speakingDir + 'Leon Wiles.jfif', 'Leon Wiles') }),
    custom('Testimonial - Joe', 43, { title: 'Joe Valentino', quote: 'Amanda is a natural communicator who understands how to connect authentically with people.', attribution: 'Joe Valentino, Executive Vice President, Commercial Growth, Strategic Partnerships, Board Director & Strategic Advisor, equalpride', image: image(speakingDir + 'Joe Valentino high res.webp', 'Joe Valentino') }, 'Image Left'),
  ] },
  { key: 'learn', sections: [
    section('hero', 10, { note: 'Library', title: 'Ideas worth thinking about.', body: ['A searchable collection of essays, AI prompts, decision briefs and business cases exploring better questions, better decisions and the future of work.', "Browse by topic, search for something specific or discover something you weren't looking for."], image: image(homeDir + 'Amanda Johnson Library.jpg', 'Amanda Johnson in the Library') }),
    section('what-youll-find', 20, { eyebrow: 'Browse by topic', title: 'The Library', list: ['All', 'Essays', 'Decision Briefs', 'AI Prompts', 'Case Studies', 'Videos', 'Speaking', 'The Decision Room (Members)'], body: ['Library preview: searchable resources will be added in the next implementation stage.'] }),
    section('access-membership', 30, { eyebrow: 'Access', title: 'Public / Decision Room Members', ctas: [cta('Explore The Decision Room', '/membership'), cta('Member area preview', '/member-home', 'ghost')] }),
  ], hide: ['how-to-use', 'learning-context', 'invitation'] },
  { key: 'blind-dinners', sections: [
    section('hero', 10, { note: 'The Blind Dinner', title: "Sometimes the most important table isn't the one you're invited to.", subhead: "It's the one you build yourself.", image: image(dinnerDir + '475-IMG_5974.JPEG', 'The Blind Dinner gathering') }),
    section('what-it-is', 20, { title: 'The Blind Dinner', body: ['The Blind Dinner is an intentionally curated gathering of accomplished strangers who come together for an evening of honest conversation, genuine connection and unexpected possibility.'], image: image(dinnerDir + '334-IMG_5725.JPEG', 'A dish prepared for The Blind Dinner') }),
    section('who-comes', 30, { title: 'Guests come as strangers.', body: ['They leave as collaborators, trusted advisors and lifelong friends.'], image: image(dinnerDir + 'cover_20426-IMG_5910.JPEG', 'Guests at The Blind Dinner') }),
    section('how-it-works', 40, { title: 'By invitation only.', image: image(dinnerDir + '499-IMG_6013.JPEG', 'Conversation at The Blind Dinner') }),
    ...Array.from({ length: 4 }, (_, i) => custom(`Dinner Gallery ${i + 1}`, 50 + i,
      { ...(i === 0 ? { title: 'The Blind Dinner' } : {}), galleryFolder: dinnerDir, galleryPart: i }, 'Gallery')),
  ], hide: ['relationship-to-membership'] },
  { key: 'membership', sections: [
    section('hero', 10, { note: 'The Decision Room', title: 'A private advisory community for Black women.', subhead: 'Think of it as your personal board of directors.', image: image(decisionDir + 'The Decision Room MAIN PAGE.jpg', 'The Decision Room artwork') }),
    section('whats-inside', 20, { title: 'The Decision Room', list: ['Monthly advisory boards.', 'Private community.', 'Confidential discussions.', 'Curated introductions.', 'The Library.', 'Invitation-only dinners.'] }),
    section('who-this-is-for', 30, { title: 'Membership is intentionally limited.', ctas: [cta('Explore Membership with Amanda', 'mailto:amanda@cupcakesandbroccoli.com?subject=The%20Decision%20Room')] }),
  ], hide: ['essays', 'decision-case-studies', 'practical-tools', 'ai-done-properly', 'pricing-reality-check', 'should-i-launch-this', 'vendor-partnership-checklist', 'capital-fit-funding-decisions', 'ai-when-to-use-it', 'real-life-decisions', 'live-sessions'] },
  { key: 'member-home', newPage: true, sections: [
    section('hero', 10, { note: 'The Decision Room - Member Area Preview', title: 'Welcome back.', subhead: 'What decision are you thinking through today?', body: ['The member area is being prepared. This is a public preview, not an active sign-in or a private member space.'], image: image(decisionDir + 'THE DECISION ROOM \u2013 MEMBER HOME HERO PHOTO.jpg', 'The Decision Room member area artwork'), ctas: [cta('Explore Membership with Amanda', 'mailto:amanda@cupcakesandbroccoli.com?subject=The%20Decision%20Room')] }),
    custom('The Library', 20, { title: 'The Library', body: ['Explore essays, decision briefs, AI prompts and member resources.'], ctas: [cta('Open Library', '/learn')] }, 'Text Only'),
    custom('In the Room', 30, { title: 'In the Room', body: ['One of the greatest strengths of The Decision Room is the women inside it.', 'Search by profession, education, location or sorority to discover members you may want to meet, learn from or simply get to know.', 'Coming next: member search, profiles and saved resources. No member information is displayed or collected in this preview.'] }, 'Text Only'),
  ] },
];
