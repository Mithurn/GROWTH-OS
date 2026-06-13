XENO
Engineering Take-Home Assignment
Build an AI-Native Mini CRM for Reaching Shoppers
Hello, and thank you for your interest in joining Xeno as an engineer!
Xeno helps consumer brands reach their shoppers in meaningful, data-driven ways —
organising customer data, deciding who to talk to, and running personalised campaigns across
channels like WhatsApp, SMS, Email and RCS. This assignment gives you a taste of the kind
of work we do every day, and gives us a window into how you think, build, and ship.
This is the same assignment for both our SDE and FDE roles. We want to see how you
approach an open-ended product problem, end to end.
The Challenge
Build and deploy an AI-native Mini CRM that helps a brand intelligently reach its
shoppers.
Imagine a Direct-to-Consumer or retail brand — say a fashion label, a coffee chain, or a beauty
brand — with a base of shoppers and their purchase history. Your product should help that
brand decide who to talk to, what to say, and reach them over messaging channels like
WhatsApp, SMS, Email and RCS.
At a minimum, the system you build should be able to:
• Ingest data — take in customers and their orders, and store them.
• Segment shoppers — let the marketer (or your AI) carve out audiences from that data
based on behaviour and attributes.
• Send personalised communications — dispatch tailored messages to a chosen
audience through a channel service (see below).
• Surface communication performance insights — track and present how
communications performed (e.g. sent, delivered, failed, opened, read, clicked, order
came because of this communication) at the campaign and/or audience level.
Beyond that, how you build it is deliberately up to you. We are not handing you a list of
modules and screens like a traditional spec. Figuring out exactly what to build — and what NOT
to build — is part of what we are evaluating.
What we mean by “AI-native”
The word “intelligent” above is intentional. We want to see AI woven into the product itself, not
bolted on. There is no single right shape for this — and we expect different candidates to make
very different bets. For example:
• A classic product interface where AI assists the marketer at key steps (e.g. drafting
messages, suggesting segments).
• A chat-first experience where the marketer describes intent in natural language and
the product responds.
• An AI that helps the marketer think, decide and act — surfacing the right audience,
recommending the message, choosing the channel.
• A true AI agent that takes a broad goal brainstormed with the marketer and then
executes the campaign end to end.
These are illustrations, not requirements. Pick a point of view and commit to it.
The Channel Service (Important)
Do not integrate any real messaging provider. Instead, we want you to stub the channel
yourself as a separate service, and model the full lifecycle of a communication. Concretely:
• Your CRM exposes a send API. When a campaign goes out, the CRM calls a separate
stubbed channel service with the communication details (recipient, message, channel).
• The channel service does not actually deliver anything — it simulates outcomes.
Asynchronously, it calls back into a CRM receipt API with what “happened” to each
communication: delivered, failed, opened, read, clicked, and so on.
• The CRM ingests these callbacks and updates the state and stats of each
communication accordingly.
This two-service, callback-driven loop is deliberate — it’s close to how channel delivery and
engagement tracking actually work, and how you model it tells us a lot. How you handle volume,
ordering, retries, and failures in this loop is exactly the kind of system-design thinking we want
to see.
Scope: What This Is (and Isn’t)
To keep everyone pointed in the right direction:
• This IS a CRM for reaching shoppers / consumers — a marketing and engagement
tool, in the spirit of what Xeno does today.
• This is NOT a sales or customer-support CRM for managing deals, pipelines, leads or
tickets (think Salesforce, Attio, Clarify). Please don’t build that.
Within that boundary, the depth, the data model, and the “intelligence” are all your calls to make.
Use realistic, well-simulated data — you don’t need real customers or real orders to
demonstrate this well.
What We’re Evaluating
Read this carefully — it should guide every decision you make.
What we evaluate What we're looking for
Build & deploy (table
stakes)
A live, hosted, working product with a walkthrough video. This
is the baseline expectation, not a differentiator — you stand
out on everything below.
Creativity in scoping How sharply you figured out WHAT to build. The brief is
intentionally open. The best submissions make bold,
opinionated product choices rather than building everything
shallowly.
What we evaluate What we're looking for
AI-native development How well you leveraged AI to build. We want to see an
AI-native workflow — how you direct, review, and integrate AI
output, not whether you used it.
Code quality & structure Clean, readable, well-organised code with sensible structure.
We will read your code and ask about it.
System design & scalability Your scale assumptions and the tradeoffs you consciously
made. We care about your reasoning more than a perfect
architecture.
Thought clarity &
communication
How clearly you think, present, and explain — in your video
and in your decisions.
In short: a working, deployed product is the baseline. You stand out on the creativity of what
you chose to build, how AI-native your approach and your workflow were, the quality of your
code and system thinking, and how clearly you can present it all.
Deliverables
1. A hosted, working product. A public URL we can open and use.
2. Your code. A repository (e.g. GitHub) we can read. Your interviewers will review it and
ask detailed questions about your choices and logic, so make sure it’s your own work.
3. A short walkthrough video, narrated by you. Around 5–6 minutes. A structure that
tends to work well is below — treat it as a suggestion, not a mandate. What matters is
that you cover the product, the thinking, and the build clearly.
Section Suggested
time
What to cover
Product intro ~0.5 min What you built and why. The problem you chose to
solve.
Functional demo ~1.5 min End-to-end product demo. Show it actually working.
Technical architecture ~1 min Your architecture diagram and the reasoning behind
each major decision.
Code walkthrough ~1 min Walk us through the structure and a couple of key
parts of your code.
AI-native workflow ~1 min How you leveraged AI while building — how AI-native
your dev workflow was.
A Few Ground Rules
• Use AI freely. We actively want you to. We are an AI-native company and we expect our
engineers to be AI-native too. Just be ready to explain and defend everything you ship
— we will ask.
• Make your tradeoffs explicit. State your scale assumptions and what you consciously
chose not to do. “I’d do X at scale but did Y for this scope” is a great answer.
• Pick your own stack. Use whatever lets you build and ship best. We have no stack
requirement for this assignment.
• Originality matters. Your code will be closely reviewed and discussed live. Understand
everything in your submission.
Timeline & Submission
Submissions are due by 12 PM on June 15, 2026. Submit your hosted URL, repository link, and
walkthrough video via the following submission form.
Submission link for FDE candidates
Submission link for SDE candidates
We’re genuinely excited to see what you build. Surprise us. ✨