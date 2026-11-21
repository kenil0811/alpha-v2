# Limits and ethics of people analytics

Depth for `chro/references/people-analytics.md`, steps 7 and 9. What can go wrong once people data is analysed, and the ethical standards for doing it, drawing on published work on HR analytics usage, ethics and limits.

## The analyst is doing science, under constraints
Treat any people analysis as a small research study: a question, a design, data, a test, and a sceptical look at the result. Three constraints get in the way.

| Constraint | What it looks like | What to do |
|---|---|---|
| Objectivity | The analyst works for leaders who may want a particular answer, or have already spent heavily on a programme and don't want to hear it failed | Agree the question and the success test before looking at results; look actively for what didn't work; report null and negative findings |
| Ability to experiment | You can only analyse the data you have. It is widely argued to be unethical to withhold something like a bonus from a random group just to create a comparison | Look for natural comparison groups: a staggered rollout, one site that adopted later, a policy that applied from a cut-off date |
| Data availability | Data not collected, groups missing, fields incomplete | Audit data quality first; know who is missing and why |

Reconciling with randomised trials (standard practice): if a test is needed, randomise only the **timing** of something everyone will get (which teams get the new onboarding this quarter and which next), never whether people get a benefit at all, and tell staff a trial is running.

## When the metric becomes the job (metric-oriented behaviour)
Once one number is chosen and reported regularly, it starts to drive behaviour; this is called institutionalised metric-oriented behaviour. Four effects:
1. Managers manage the number instead of the people.
2. Staff focus on doing well on that number.
3. Other important behaviour is ignored, or actively discouraged when it hurts the number.
4. Some people are disadvantaged because they can't reach the number for reasons unrelated to performance.

Example: weekly checkout scan rates. Faster scanning shortens queues, but pressure on speed discourages friendly service, penalises some staff with disabilities and staff on quiet shifts, and at least one grocer dropped the measure. Other common cases: call length and time on the phone in call centres, billable hours in professional firms, student evaluation scores, team engagement scores.

Fixes:
- Before launching any metric, ask what unintended behaviour a focus on this one number could produce, and who can't reach it through no fault of their own.
- Use a balanced set of measures for anything important (output, quality, customer view, behaviours), never one number. For a topic like diversity, look at several indicators: representation by team and by level, leavers, promotions, engagement by group.
- Watch the analyst's own focus: modelling the favourite metric again and again reinforces it.

## Who is actually in the data?
Most errors in people analytics are sample errors, not formula errors.
- **Filters exclude people silently.** A model that needs two years of sales leaves out everyone with under two years' tenure; one that needs customer ratings leaves out anyone whose customers didn't respond. Say who the result applies to.
- **Voluntary surveys skew engaged.** A team's engagement score often comes from those who chose to answer, who tend to be more engaged. Linking it to team sales (from everyone) compares two different groups and can hide a real link.
- **Timing gaps.** With annual appraisals, recent joiners have no rating yet.
- **Missing groups.** If one group lacks a field (for example a question that can't legally or safely be asked in some countries), the whole group may drop out. Always compare the number of people the analysis actually used with the number it should have used, and find out who is missing.
- **Different meanings across sites or countries.** Who counts as an employee, or what a grade means, can differ with local law and practice.
- **The missing factor.** A variable not in the model (role, gender mix, tenure, shift) may explain the result. Add plausible control variables, and look for interactions: the effect of one thing may depend on another.

## Give the analysis time
A good model is not a one-pass job. Leave time to: (1) explore the data, (2) frame the right question, (3) test candidate models, (4) run the analysis, (5) interrogate the result, (6) rerun after fixing problems found, (7) interrogate again. Teams that spend all their time producing routine descriptive reports never get here, and their recommendations rest on first-pass results.

## Be sceptical before you recommend
- Correlation is not causation, even with data over time.
- State every assumption, especially who is and isn't represented.
- Check the measures themselves are reliable and valid; part of any outcome's variation is measurement error (see `chro/references/people-analytics/validating-a-measure.md`). Poor data in, poor findings out.
- Expect modest, conditional findings, not transformation.

## Ethics

### Confidentiality and willing participation
HR holds data people gave voluntarily and data the firm created about them (pay, ratings). Contracts may say the firm owns it, but some data always falls outside what people agreed to.

### The discomfort test
Before any new analysis ask: would I be uncomfortable if this were done to me or my family without our knowledge? If so, tell the workforce what is planned and offer an opt-out. A cautionary example: a bank linked staff canteen purchases and gym-equipment use (from ID-card swipes) to call-centre performance, producing an "ideal" meal and workout profile. Retailers profile shoppers the same way, but an employer holds power over the employee, so the same analysis becomes surveillance.

### Who owns the data
When it is unclear whether data was collected for this use, tell HR and the workforce before using it.

### Security
People data now includes pay, bank details, birth dates and behavioural traces, and linking sources multiplies the harm of a breach. Know the data-protection law in each country you operate in (the EU's is notably strict) and follow it.

### Profiles become stereotypes
If analysis finds that one demographic profile performs best (for example women in one age and education band scanned fastest), hiring to that profile is illegal discrimination and also bad inference: the spread within any group is about as large as the gap between groups.
- Never turn a demographic pattern into a selection rule.
- Show the exceptions: high performers outside the profile, low performers inside it.
- Look for the conditions behind the pattern (shift, training, tenure), which the business can act on.

### Six standards for an analytics team
Drawing on a published set of analyst ethical standards:
1. Comply with the law.
2. Check the work fits cultural and social norms, beyond the law.
3. Weigh the effect on stakeholders' trust and don't breach it.
4. Name one accountable person and write a data policy.
5. Secure the data.
6. Add safeguards in proportion to how sensitive the area is.

A professional HR code (the UK's main HR body) adds integrity, respect for others' beliefs and customs, equal opportunity and dignity, and never using personal data for anyone's advantage or detriment.

### Remember the people
Words like "heads", "resources" and "capacity reduction" make it easy to forget that sickness absence figures include real suffering and that "rightsizing" means job loss. Write reports in plain human terms.
