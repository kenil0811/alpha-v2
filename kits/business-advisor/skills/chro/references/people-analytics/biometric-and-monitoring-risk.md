# Biometric and monitoring risk

Depth for `chro/references/people-analytics.md`, step 7. Use before buying or switching on any tool that watches staff or candidates: badge and Wi-Fi tracking, keystroke and screenshot tools, desk sensors, video-interview scoring, facial recognition, voice or emotion analysis, wearables.

## What counts as biometric
Measures of the body or its behaviour: fingerprints, iris, face shape, veins, voice, breathing, brainwaves, gait, typing rhythm, other movement. Most use so far has been checking identity; the riskier use is claiming to read state of mind or behaviour from them.

## Uses that can help everyone
There are examples where staff benefit too: desk heat sensors used to plan office layout and desk allocation, and brainwave-sensing safety hats used by a mining firm to catch truck-driver fatigue. Benefit to the people measured is the first test.

## Why "legal" is not enough: privacy and dignity
- **Privacy**: a person's right to control their information and be free from intrusive monitoring.
- **Dignity**: each person's worth and the respect owed to it. It splits into inherent dignity (moral respect owed to everyone) and behavioural dignity (access to the resources for a good life, such as a job).
- **"Creepiness"**: the unease people feel when technology takes information they gave unknowingly or reluctantly. It rises when they fear the data will be used against them. It signals an expected harm to dignity.
- A system can obey privacy law and still harm dignity. Face-matching at airport gates follows the rules but subjects everyone to constant scrutiny, and fails more often for some ages, genders and skin tones, so rightful travellers get stopped.
- **Hiring case**: an AI video-interview product scored candidates' facial movements, words and voice, gave no explanation of what earned a good score, and faced a class action in a US federal court over collecting biometric identifiers without proper consent. A candidate screened out with no insight or recourse has lost access to a job: a direct harm to behavioural dignity.
- **Retail case**: a US drugstore chain's facial-recognition anti-theft system was deployed mostly in low-income areas with many residents of colour, produced many false matches and wrongful accusations, and drew enforcement by the US consumer-protection regulator.
- **Customer backlash case**: a grocery chain dropped checkout video surveillance after public objections, including reports that footage was reviewed by offshore workers.

## The law is moving towards biometrics specifically
As of 2024: the EU's data-protection regulation treats biometric data as a special category needing explicit consent; the US consumer-protection regulator has warned firms to assess foreseeable harms before collecting biometrics; one US state now protects brain-wave data; a European data regulator ordered an iris-scanning identity project to stop collecting; advocacy groups call for bans on biometric recognition. Expect more of this, and get local legal advice before collecting anything (monitoring law varies by state and country and some places require notice to staff).

## Two design choices that lower the risk
1. **Scan the interaction with objects, not the person.** Ask whether you truly need to scan a human. Alternatives: less intimate signals (typing rhythm rather than face or iris), or tracking the object (for example smart carts that weigh and scan goods after a normal login, giving the same checkout convenience as palm or video systems without any biometric). For staff: count jobs completed in the system rather than filming the worker; log equipment use rather than tracking bodies.
2. **Prefer small, restricted, open models that run on the device.** Sending raw biometric data to remote servers takes control away from the person. For most tasks a small on-device model does nearly as well, and the data never leaves.

## How monitoring backfires
The cycle of coercive surveillance: managers distrust staff, so they monitor more; staff feel watched, so they hide their work and mask their feelings; managers see less, so they monitor more. Text and video analytics also degrade as soon as people know they are watched.

## Checklist before switching on any monitoring or biometric tool
**Purpose**
- [ ] What decision will this data inform, and who benefits? Do the people measured benefit (safety, fair workload, easier access)?
- [ ] Could the same aim be met without scanning people (objects, system logs, self-report, sampling)?
- [ ] Is the least intimate signal used (typing pattern over face; aggregate desk use over individual tracking)?

**Inventory and law**
- [ ] List what is already collected: badges, Wi-Fi location, keystrokes, screenshots, cameras, card swipes in canteens or gyms.
- [ ] Legal advice obtained for every country and state involved; notice and explicit consent where required.

**Validity and fairness**
- [ ] Evidence the tool measures what it claims, in a population like yours (emotion from faces is a weak assumption).
- [ ] Error rates by age, gender, skin tone and disability checked; false positives have a human review before any action.
- [ ] People can see what drives a score and challenge it.

**Data handling**
- [ ] Processed on device or in a restricted environment where possible; raw biometrics not kept.
- [ ] Retention period, access list and one accountable owner written down.
- [ ] Never repurposed (for example safety data later used in appraisals) without fresh notice and consent.

**People**
- [ ] Discomfort test passed: would you accept this done to you or your family?
- [ ] Staff told in plain words what is collected, why, who sees it and for how long; an opt-out where feasible.
- [ ] Trust effect weighed: is there a risk of starting the surveillance cycle?
- [ ] Review date set to drop the tool if it isn't earning its keep.

## Worked pattern
A 25-van delivery firm is offered driver-facing cameras with fatigue and "distraction" scoring.
- Purpose: fewer accidents. Drivers benefit too, so a safety use has a case.
- Lower-intimacy alternative first: route-length and hours-driven limits from the van telematics already installed, plus a self-report fatigue check at the start of each shift.
- If cameras are still wanted: alerts in the cab only, processed on the device, no footage kept unless a crash sensor fires; scores never used in appraisals or pay; error rates checked for drivers who wear glasses or have darker skin; drivers shown the system and the policy before go-live; review after six months against accident and near-miss counts.
