# People analytics

> **Area:** `people-analytics` · owned by the CHRO skill. **Use when:** Build, check or challenge a measure of people at work (hiring scores, interviews, performance ratings, engagement surveys, sentiment or video analytics, monitoring and biometric tools) so staffing, pay and policy decisions rest on numbers that are valid, reliable, fair and accepted, and show which people measures actually move business results. Use when a business hires, rates or ranks staff, writes a staff survey, buys an HR analytics, AI-screening or monitoring tool, or wants to start tracking something about its people.

## Outcome
People decisions made on measures that capture what they claim to, give the same answer twice, survive scrutiny from the people measured, and are rolled out without breaking trust or inviting gaming.

## When to use
- "How should we decide who to hire?" or "Are our interviews any good?"
- "Our performance ratings feel arbitrary" or "the same people always get top marks."
- A vendor pitches an engagement pulse, sentiment monitor, AI interview or productivity score.
- "We want to tie pay or promotion to a number."
- Turnover, absence or engagement is a worry and someone asks for a dashboard.
- Staff push back on a new metric, or start working to the metric instead of the job.
- "Write our engagement survey" or "why did our survey scores jump?"
- "Does our training (or engagement, or retention effort) actually pay?"
- Someone proposes cameras, wearables, keystroke tracking or biometric sign-in.

## Method

### 1. Start from strategy and a construct definition
Bad measures damage three things: who gets hired or promoted, which policies are chosen, and whether people feel fairly treated. So start with what matters to the business, then define it before choosing any number.

Three terms, kept apart:
- **Construct**: the real but unseen thing you care about (job performance, engagement, potential, teamwork).
- **Metric**: the observed score you use to stand in for it (a manager's rating, a survey score, sales per month).
- **Error**: everything apart from the construct that moves the score (mood, time of day, a weak market, the rater's bias, chance).

Write a construct definition that states:
1. The general domain (what kind of thing it is).
2. Its sub-dimensions (for example task-focused versus person-focused leadership).
3. Whose property it is: a person, a team or the whole firm.
4. How stable it is: a fixed trait, or a state that moves week to week.

The richer the construct, the harder it is to measure well. Narrow it until it can be measured, and say what is left out.

Work top-down: write how people create value in this business, then pick measures for each link. Starting from whatever data already exists ("available, not relevant") is the commonest failure. Check each measure for **deficiency** (parts of the construct it misses) and **contamination** (things it picks up that aren't the construct), and know what kind of number it is (category, rank, scale or true quantity): `chro/references/people-analytics/validating-a-measure.md`.

### 2. Judge any measure on validity and reliability
Classical test theory gives the frame: **observed score = true score + error** (X = T + E). Measure the same thing many times and the average converges on the true score, provided the errors are random. Two consequences:
- **Reliability** is the share of the variation in scores that comes from real differences between people rather than error. A measure is reliable when it gives the same answer under the same conditions.
- **Validity** is whether differences in the score are caused by differences in the construct. A measure can be reliable and still invalid (a scale that is always 2 kg out).

Three practical validity checks, cheapest first:
| Check | Question | How to test |
|---|---|---|
| Face validity | Do the people measured, and the people using the scores, see it as legitimate? | Ask both groups; count the share who accept it |
| Convergent validity | Does the score move with related things as theory says it should, and not with unrelated things? | Measure several related variables and check the signs |
| Criterion (predictive) validity | Does the score predict an outcome the business cares about? | Correlate scores with later performance, retention, sales; this is the return-on-investment test |

Three reliability checks:
- **Test-retest**: same people, two points in time. Only fair if the construct shouldn't have changed.
- **Inter-rater**: two or more raters score the same people. Costly; raters can share a bias.
- **Inter-item**: several differently worded questions on the same construct. People tire of near-duplicate questions.

Rules of thumb: assessing validity and reliability imperfectly beats not assessing them; and more independent measures (raters, items, occasions) averaged together track the true score more closely, because random errors cancel. Errors that are not random (a shared bias, a vague question, raters who rarely see the work) do not cancel; more of them adds error.

A quick screen for any data set (from research on rating others): is it **reliable** (steady when nothing has changed), **variable** (shows real, unforced range) and **valid** (predicts something measured another way)? Check reliability first.

Formulas, a multi-trait multi-method matrix and how to read it: `chro/references/people-analytics/validating-a-measure.md`.

### 3. Watch for method effects
The instrument itself can push scores in a systematic way. Examples: survey takers avoid the ends of a scale; computer vision can miss darker skin tones; a manager rates everyone they like higher on every dimension. That is contamination, not random error, and averaging won't remove it. The test is to measure **several traits with several methods** and check that the same trait agrees across methods more than different traits agree within one method.

### 4. Choose the measurement method for attitudes
| Method | Strengths | Weaknesses |
|---|---|---|
| Self-report survey | Many validated scales; seen as credible | Costly to run well; slow from survey to action; answers shaped by wording, memory, wanting to look good, and the response options |
| Text sentiment analysis (emails, chat, suggestion boards, transcribed meetings) | Continuous, cheap to collect | Word-list scoring misses sarcasm and context; trained models inherit their training data; people mask when they know they are watched |
| Computer vision and voice | Captures expression and tone at scale | Assumes faces show feelings reliably; method bias across groups; heavy privacy cost |

Self-reports are shaped by the instrument because people treat every part of a questionnaire as a clue to what is wanted. They understand the question, recall or estimate, judge, map the judgement to your options, then edit it to look good. The rules that matter most (from research on how questions shape answers):
- Answer options define the question: a listed option gets chosen far more than when people answer freely, and the range of frequency options sets what counts as "normal". Ask for counts with a unit ("days in the last two weeks: ___"), never "often" or "sometimes".
- The numbers on a scale and the length of the recall window change what people think is being asked; keep both fixed across waves.
- Earlier questions colour later ones. Ask general questions before specific ones; a specific-first order can more than double how strongly the two appear linked.
- Who sponsors the survey and what anonymity is promised change the edited answer.
- Bland items bunch at the top; wording with a strong anchor ("every day") spreads people out. Ask people about their own experience, not others' qualities.
- Pretest with think-aloud interviews.

Full rules, checklist and a worked rewrite: `chro/references/people-analytics/survey-and-question-design.md`.

Three ways to build the capability: open-source analytics tools (cheap software, pay for skills), general cloud analytics platforms (low entry cost, pay to build the application), or specialist HR analytics products (highest cost, still need people who can interpret them). Easy data collection does not remove the need to validate; black-box tools deployed at scale need it more.

Why attitudes matter in money: absence, low engagement and turnover. Rough turnover costs per leaver are about half a year's salary for entry roles, about 1.25 times salary mid-level and about twice salary for senior roles.

### 5. Hire on valid predictors (selection)
Split what you are judging:
- **Person-job fit**: has the person the knowledge, skills and abilities the job needs? Do a job analysis, write the attributes down, then design measures for each, checked for adverse impact on protected groups.
- **Person-organisation fit**: do their values match the culture? Usually done badly, by assuming anyone who meets the candidate can sense it. Vague attributes ("executive presence", "team player", "fit") produce contaminated scores. If fit matters, define the values in behaviours first.

Stronger methods: standardised tests, work samples and assessment centres, structured interviews, relevant biographical data. Weaker: recruiter impressions, unstructured interviews, company visits and informal contact.

**The unstructured interview problem.** Interviewers build a confident story from whatever they see, even from random answers, and the story then crowds out better evidence such as past results. In one admissions case, applicants rejected after interview but admitted anyway did as well as everyone else. Fixes: ask every candidate the same job-related questions, score each answer on a written scale before moving on, use interviews to test job skills, and weigh the interview against the other evidence rather than letting it override it.

**AI-assisted selection.** Hiring is a classification problem; models trained on past human decisions can lock in past bias, and litigation over AI hiring is growing. Trust neither the algorithm nor the manager by default: validate both against later performance.

Interview build, scoring sheet and AI-tool checks: `chro/references/people-analytics/hiring-and-performance-measures.md`.

### 6. Measure performance fairly
A performance evaluation scores how far someone showed the desired behaviours and hit agreed goals over a past period. Three traps:
- **Sticky beliefs**: once a manager thinks someone is strong, later evidence is read to fit.
- **Unequal assignments**: jobs and territories differ in difficulty.
- **Non-random assignment**: the best people get the hardest cases, so their raw results look worse. Adjust for inputs, as value-added measures of teachers adjust for pupils' prior scores.

The rater is the method effect: a boss's ratings carry their relationship with each person. If one rater's scores on two different dimensions correlate strongly with each other but weakly with a second rater's scores on the same dimension, the ratings mostly measure the rater.

Research on rating others goes further: in the largest studies about 54 to 60% of the variation in ratings of people comes from each rater's own habitual pattern (lenient or tough, wide or narrow), and it travels with the rater whoever they rate. Detailed anchors make it worse; colleagues also see too little of each other's work to rate abstract qualities. Forced curves and calibration meetings create range rather than reveal it.

Fixes: define performance for this job in this firm first; count what can be counted (output, quality, customer outcomes); measure the same thing in several ways; replace ratings of qualities with questions about the leader's own reaction and intent ("do I go to this person when I need extraordinary results?", "would I promote them today?"), adjusted for each leader's rating pattern; be ready to show the measure is valid, or lose good people who feel misjudged. Details: `chro/references/people-analytics/hiring-and-performance-measures.md`.

### 7. Settle ethics and privacy before you collect
Rules:
1. Get privacy-law advice before any new monitoring. Laws on electronic monitoring change fast by state and country; some require notice to staff.
2. Law is necessary but not enough. Test the programme two ways: does it violate anyone's basic rights (rights view), and does it produce more benefit than cost for the firm and its staff (utilitarian view)?
3. Adopt and publish a short statement of principles: comply with the law; respect norms; weigh the effect on trust; make someone in HR accountable for data; secure the data; add safeguards in proportion to sensitivity.
4. Beware the cycle of coercive surveillance: managers distrust, so they monitor more; staff feel watched, so they hide their work; managers see less, so they monitor even more.
5. Leaders often don't know what their systems already track (badge swipes, Wi-Fi location, keystroke and screenshot tools, canteen and gym card swipes). Inventory it.
6. Apply the discomfort test: would you accept this analysis done to you or your family without your knowledge? If not, tell staff and offer an opt-out.
7. Never turn a demographic profile of top performers into a hiring rule: it is discrimination, and the spread within any group is about as large as the gap between groups.
8. Biometrics (face, voice, iris, typing rhythm, brainwaves) need more than legal compliance: a system can respect privacy law and still harm dignity, for example scoring candidates' faces with no explanation or recourse. Ask whether you need to scan people at all, or can track objects and system logs instead; prefer the least intimate signal and small models that keep data on the device. EU law treats biometrics as needing explicit consent, and regulators are acting against discriminatory or unexplained use.

Monitoring and biometric checklist: `chro/references/people-analytics/biometric-and-monitoring-risk.md`. Analysis limits, sample traps and ethics standards: `chro/references/people-analytics/ethics-and-limits.md`.

### 8. Roll out a new measure as a change
New measures are political because people often disagree whether they are valid (often with reason), and because they are tied to pay, promotion, status and budget. Politics rises with disagreement and interdependence, and is amplified by scarce resources and high stakes. Expect:
- **Resistance**: people don't see why it is needed, fear uncertainty, feel their ego threatened, or have had no voice.
- **Gaming**: people look for loopholes, to protect the status quo or win an edge.
- **Managing to the measure**: one metric crowds out other good behaviour, worst just after launch.

Response: tie the measure to purpose and values, map and involve stakeholders (especially those being measured), address the reasons for resistance, look for the loopholes yourself first, name the behaviour the measure might squeeze out, and over-communicate (see `leading-change` and `power-and-influence`). Use a balanced set of measures rather than one number: a single metric reported every week becomes the job (call length in call centres, scan rate at checkouts, billable hours), squeezes out unmeasured good work and penalises people who can't hit it for reasons outside their control. Then keep re-checking reliability and validity after launch.

### 9. Link people measures to business results
A level (engagement 3.5 out of 5, turnover 15%) means little alone; benchmarks only say better or worse than someone. Show the relationship in business units instead:
1. Write the chain: people practice, then people outcome, then operational driver, then customer, then money.
2. Measure at the same level of analysis as the result (person, team, branch), aggregating up or building a parallel measure lower down.
3. Collect over many periods, not once a year, so leads and lags can be tested.
4. Control for any third factor that moves with both the people measure and the result; one that moves with only one of them can't bias the link.
5. Express the effect in units ("a 1% rise in the engagement index goes with about 0.5% higher customer satisfaction"), not as a correlation, and check for thresholds (customers scoring 10 out of 10 may recommend far more than those scoring 9).
6. Before trusting the result, check who was in the data (tenure filters, voluntary survey responders, missing groups).
Proving a few links (people practice to retention to cycle time) is progress even without the full chain to profit. Method and worked example: `chro/references/people-analytics/linking-measures-to-results.md`.

## Worked pattern
A 40-person IT support firm wants to pick a "technician of the year" and link a bonus pool of £30k to performance ratings.
- **Construct**: performance = resolving client problems correctly, quickly and courteously; an individual property; changes over months.
- **Current measure**: one rating per person from their team lead, 1 to 5. Leads A and B each rate 20 people.
- **Reliability check**: both leads re-rate a shared sample of 12 technicians they both work with. Agreement is weak (correlation 0.35), and each lead's "technical skill" and "client care" scores correlate at 0.8 within their own ratings: mostly a rater effect.
- **Inputs differ**: lead A routes the hardest escalations to two senior technicians. Their raw client-satisfaction averages are 4.1 against a team average of 4.4. Adjusting for ticket difficulty (compare each ticket's score with the average for its difficulty band) puts both in the top quartile.
- **New measure**: 40% difficulty-adjusted client satisfaction, 30% first-time-fix rate, 30% average of two leads' structured ratings on written behaviour anchors.
- **Rollout**: technicians review the draft; two point out that first-time-fix can be gamed by closing tickets early, so reopened tickets within 7 days count as failures. Bonus is paid on the new score only after one quarter's trial run in parallel.

## Common mistakes
- Picking a number before defining what it should capture.
- Treating a reliable measure as a valid one.
- One survey question, one rater or one interview as the whole measure.
- Letting a pleasant interview overrule better evidence; mistaking a flowing conversation for a good candidate.
- Comparing raw results when assignments were not random.
- Buying "plug and play" AI scoring without validating it on your own people, or assuming humans are automatically better.
- Using personality-type tools (for example a 16-type indicator) for selection or team design: retest results often change type and evidence of a link to job performance is weak.
- Adding monitoring because it is easy to collect, without a legal check, a stated purpose or a plan for trust.
- Launching a pay-linked metric without asking how it will be gamed or what it will crowd out.
- Measuring what is already available instead of what matters; benchmarking levels and calling that strategy.
- Reading a correlation as an effect, or reporting it to managers as the answer.
- Survey items with vague quantifiers, range-defining answer options, or a changed order between waves that then shows up as a "trend".
- Trusting a rating because it has detailed anchors, many raters or a calibration meeting behind it.
- Linking a voluntary survey's scores to whole-team results without checking who answered.
- Treating legal compliance as enough for monitoring or biometric tools.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps

- Attrition modelling, pay analytics and HR experiments are covered only briefly, as standard practice.
