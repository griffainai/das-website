/* ============================================================================
   DAS SURVEY DEFINITIONS — the single source of truth for all three instruments
   ----------------------------------------------------------------------------
   Loaded BOTH ways on purpose:
     • browser  → window.DAS_SURVEYS   (js/survey-app.js renders from this)
     • node     → require('../js/survey-defs.js')  (api/_survey.js labels the email)

   One definition, two consumers. If the server kept its own copy of the question
   text the two would drift the first time a question was reworded, and the email
   would quietly describe the wrong question.

   Transcribed verbatim from the printed booklets (2026-08-30):
     • DAS_ODNDR_Driver_Feedback_Survey.pdf            → driver      (27 Q)
     • DAS_ODNDR_Customer_Team_Questionnaire.pdf       → assessment  (74 Q)
     • DAS_2027_Driver_Recognition_Commitment_Guide.pdf → commitment (worksheet)

   QUESTION TYPES
     scale   — numeric segments with an anchor word at each end (1 Poor … 5 Excellent)
     choice  — single select. `scaleLike:true` renders it as a segmented bar so a
               5-point Likert reads as a scale, not a stack of radios.
     multi   — multi select chips
     short   — one-line text        number — one-line numeric
     text    — paragraph
     matrix  — rows × cols grid (workstream owners, retroactive census, commitments)

   The paper defect this fixes: on paper a "1 2 3 4 5 6 7 8 9 10 Rating: ___" row
   sits next to a "[ ] Rarely [ ] Annually" row with no visual difference, so nobody
   knows whether to circle, check, or write. Here every mechanic looks different.
   ========================================================================== */
(function (root, factory) {
  var defs = factory();
  if (typeof module === 'object' && module.exports) module.exports = defs;
  else root.DAS_SURVEYS = defs;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ── Shared option sets ─────────────────────────────────────────────────── */
  var AGREE   = ['Strongly disagree', 'Disagree', 'Unsure', 'Agree', 'Strongly agree'];
  var FREQ5   = ['Never', 'Rarely', 'Sometimes', 'Often', 'Very often'];
  var YESNO5  = ['No', 'Probably not', 'Unsure', 'Probably yes', 'Yes'];
  var CADENCE = ['Rarely', 'Annually', 'Quarterly', 'Monthly', 'Weekly or more'];

  /* Agreement statements repeat 7× in the driver survey — one helper, one shape. */
  function agree(id, n, label) {
    return { id: id, n: n, type: 'choice', scaleLike: true, label: label, options: AGREE };
  }
  function scale(id, n, label, low, high, opts) {
    var q = { id: id, n: n, type: 'scale', label: label, min: 1, max: 5, low: low, high: high };
    if (opts && opts.max) q.max = opts.max;
    if (opts && opts.extra) q.extra = opts.extra;
    return q;
  }
  /* The assessment's 1–10 leadership ratings. */
  function rate10(id, n, label) {
    return { id: id, n: n, type: 'scale', label: label, min: 1, max: 10, low: 'Low', high: 'High' };
  }

  /* ══════════════════════════════════════════════════════════════════════════
     1. DRIVER FEEDBACK SURVEY — public, 27 questions
     ══════════════════════════════════════════════════════════════════════════ */
  var driver = {
    key: 'driver',
    name: 'Driver Feedback Survey',
    shortName: 'Driver Survey',
    eyebrow: 'Individual driver response',
    heroWord: 'DRIVER',
    gated: false,
    audience: 'driver',
    blurb: 'Your honest answers shape what recognition looks like where you drive. It takes about six minutes, and you do not have to give your name.',
    note: 'Answer what you want to answer. Nothing here is required except your organization.',
    sections: [
      {
        title: 'About You',
        questions: [
          { id: 'd1', n: 1, type: 'choice', label: 'How long have you worked as a driver for this organization?',
            options: ['Under 1 year', '1–3 years', '4–7 years', '8–15 years', '16+ years'] },
          { id: 'd2', n: 2, type: 'choice', label: 'Which best describes your current work?',
            options: ['Local', 'Regional', 'Over-the-road', 'Dedicated', 'Other'] },
          scale('d3', 3, 'How would you rate your overall experience as a driver here?', 'Poor', 'Excellent'),
          scale('d4', 4, 'How likely are you to recommend this organization to another professional driver?', 'Not likely', 'Very likely'),
          scale('d5', 5, 'How valued do you currently feel by the organization?', 'Not valued', 'Highly valued')
        ]
      },
      {
        title: 'Your Experience',
        questions: [
          { id: 'd6', n: 6, type: 'choice', scaleLike: true, label: 'How often does your manager or supervisor recognize you for doing a good job?',
            options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Very often'] },
          agree('d7', 7, 'Recognition is applied fairly across drivers, routes, and locations.'),
          agree('d8', 8, 'The organization clearly communicates what drivers are being recognized for.'),
          agree('d9', 9, 'Positive feedback reaches drivers soon enough to feel connected to what they did.'),
          scale('d10', 10, 'How meaningful are the gifts, awards, or incentives offered today?', 'Not meaningful', 'Very meaningful'),
          scale('d11', 11, 'How satisfied were you with your onboarding or new-driver welcome experience?', 'Very dissatisfied', 'Very satisfied', { extra: 'Not applicable' }),
          agree('d12', 12, 'Service anniversaries and career milestones are recognized consistently.')
        ]
      },
      {
        title: 'Recognition & Safety',
        questions: [
          agree('d13', 13, 'Safe driving and positive driving behavior receive enough recognition.'),
          scale('d14', 14, 'How clear are the current rules for earning incentives or recognition?', 'Not clear', 'Very clear', { extra: 'No program' }),
          agree('d15', 15, 'Recognition encourages drivers to maintain or improve safe driving behavior.'),
          { id: 'd16', n: 16, type: 'choice', scaleLike: true, label: 'Would you value earning rewards throughout the year instead of only at annual events?', options: YESNO5 },
          scale('d17', 17, 'How important is being able to choose your own reward?', 'Not important', 'Essential'),
          scale('d18', 18, 'How important is being able to save earned rewards toward a higher-value item?', 'Not important', 'Essential'),
          { id: 'd19', n: 19, type: 'choice', label: 'Which reward experience would you prefer?',
            options: ['Company-selected gift', 'Choice of several items', 'Large reward catalog', 'Combination'] }
        ]
      },
      {
        title: 'Participation & Preferences',
        questions: [
          { id: 'd20', n: 20, type: 'choice', label: 'Where would you prefer recognition items to be delivered?',
            options: ['Home', 'Terminal', 'Driver event', 'No preference'] },
          { id: 'd21', n: 21, type: 'choice', scaleLike: true, label: 'Would team or terminal safety challenges increase your interest in participating?', options: YESNO5 },
          scale('d22', 22, 'How likely would you be to participate in a simple year-round driver rewards program?', 'Not likely', 'Very likely'),
          { id: 'd23', n: 23, type: 'choice', scaleLike: true, label: 'Would stronger recognition make you more likely to remain with the organization?', options: YESNO5 },
          scale('d24', 24, "Overall, how would you rate the organization's current driver recognition efforts?", 'Poor', 'Excellent')
        ]
      },
      {
        title: 'Written Feedback',
        questions: [
          { id: 'd25', n: 25, type: 'text', label: 'What does the organization currently do well when recognizing or supporting drivers?' },
          { id: 'd26', n: 26, type: 'text', label: 'What is the most important change the organization could make to improve the driver experience?' },
          { id: 'd27', n: 27, type: 'text', label: 'Describe one form of recognition or reward that would feel genuinely meaningful to you.' }
        ]
      }
    ]
  };

  /* ══════════════════════════════════════════════════════════════════════════
     2. DRIVER EXPERIENCE & RECOGNITION ASSESSMENT — gated, 74 questions
     ══════════════════════════════════════════════════════════════════════════ */
  var assessment = {
    key: 'assessment',
    name: 'Driver Experience & Recognition Assessment',
    shortName: 'Recognition Assessment',
    eyebrow: 'Organization-wide questionnaire',
    heroWord: 'FLEET',
    gated: true,
    audience: 'organization',
    blurb: 'Completed on behalf of the organization’s team. Eight sections covering fleet profile, culture, onboarding, safety, driver voice, administration, and readiness.',
    note: 'Your progress saves automatically on this device. You can close this and come back.',
    sections: [
      {
        title: 'Fleet and Operating Profile',
        questions: [
          { id: 'a1',  n: 1,  type: 'number', label: 'How many drivers are currently in the fleet?' },
          { id: 'a2',  n: 2,  type: 'short',  label: 'How many power units and operating locations do you manage?' },
          { id: 'a3',  n: 3,  type: 'multi',  label: 'Which operating models describe your drivers?',
            options: ['Local', 'Regional', 'Over-the-road', 'Dedicated', 'Mixed'] },
          { id: 'a4',  n: 4,  type: 'text',   label: 'Which transportation divisions or equipment types are represented in the fleet?' },
          { id: 'a5',  n: 5,  type: 'short',  label: 'How many drivers are company employees versus owner-operators or contractors?' },
          { id: 'a6',  n: 6,  type: 'number', label: 'Approximately how many drivers are hired or onboarded each year?' },
          { id: 'a7',  n: 7,  type: 'number', label: 'Approximately how many drivers leave the organization each year?' },
          { id: 'a8',  n: 8,  type: 'number', label: 'How many driver retirements do you typically recognize each year?' },
          { id: 'a9',  n: 9,  type: 'number', label: 'How many terminals, domiciles, or business units would need to participate in a recognition program?' },
          { id: 'a10', n: 10, type: 'multi',  label: 'Who currently owns driver recognition?',
            options: ['Safety', 'Operations', 'HR', 'Recruiting', 'Communications', 'Terminal leadership', 'Another group'], allowOther: true }
        ]
      },
      {
        title: 'Current Culture and Employee Experience',
        questions: [
          { id: 'a11', n: 11, type: 'text', label: 'How would you describe the current relationship between drivers and leadership?' },
          { id: 'a12', n: 12, type: 'text', label: 'What do drivers say they value most about working here?' },
          { id: 'a13', n: 13, type: 'text', label: 'What are the most common sources of driver frustration or disengagement?' },
          rate10('a14', 14, 'How consistent is the driver experience across locations and managers?'),
          rate10('a15', 15, 'How visible and accessible is senior leadership to drivers?'),
          { id: 'a16', n: 16, type: 'choice', scaleLike: true, label: 'How often do drivers receive positive feedback unrelated to correcting a problem?', options: CADENCE },
          rate10('a17', 17, 'How well do current recognition efforts reflect the culture leadership says it wants?'),
          rate10('a18', 18, 'From your observation, how would you rate the current driver incentive or recognition program?'),
          { id: 'a19', n: 19, type: 'text', label: 'Which is the greater immediate priority: improving retention, influencing driving behavior, strengthening appreciation, or creating consistency? Why?' }
        ]
      },
      {
        title: 'Onboarding, Milestones, and Appreciation',
        questions: [
          { id: 'a20', n: 20, type: 'text', label: 'Walk us through what a new driver receives or experiences from offer acceptance through the first 90 days.' },
          { id: 'a21', n: 21, type: 'choice', label: 'Is there a standardized onboarding gift or welcome kit across all locations?',
            options: ['No', 'Partially', 'Yes', 'Varies by location'] },
          { id: 'a22', n: 22, type: 'text', label: 'At which service anniversaries are drivers formally recognized?' },
          { id: 'a23', n: 23, type: 'text', label: 'How are safe-mile milestones recognized today?' },
          { id: 'a24', n: 24, type: 'text', label: 'How are retirements handled, and how consistent is the experience?' },
          { id: 'a25', n: 25, type: 'multi', label: 'Which annual appreciation moments are planned in advance?',
            options: ['Driver Appreciation Week', 'Birthdays', 'Holidays', 'Awards banquet', 'Other'] },
          { id: 'a26', n: 26, type: 'text', label: 'How far in advance are appreciation events typically budgeted and planned?' },
          { id: 'a27', n: 27, type: 'choice', label: 'Do leaders have approved recognition options at different budget levels?',
            options: ['No', 'Informally', 'Yes', 'Unsure'] },
          { id: 'a28', n: 28, type: 'choice', scaleLike: true, label: 'How often do late orders, inconsistent gifts, missing sizes, or shipping issues weaken the intended recognition moment?', options: FREQ5 },
          { id: 'a29', n: 29, type: 'text', label: 'Would a curated, branded, ready-to-present kit improve the experience compared with purchasing individual items internally? Why?' },
          { id: 'a30', n: 30, type: 'text', label: 'Which upcoming event or milestone creates the most immediate recognition need?' }
        ]
      },
      {
        title: 'Safety, Performance, and Behavior',
        questions: [
          { id: 'a31', n: 31, type: 'text', label: 'Which three driver behaviors would leadership most like to strengthen during the next 12 months?' },
          { id: 'a32', n: 32, type: 'multi', label: 'Which safety or performance data is available at the individual-driver level?',
            options: ['Telematics', 'Cameras', 'Inspections', 'Training', 'Fuel', 'Claims', 'Other'] },
          { id: 'a33', n: 33, type: 'choice', label: 'How quickly is positive safety performance recognized after it occurs?',
            options: ['Same day', 'Same week', 'Monthly', 'Quarterly', 'Annually', 'Not consistently'] },
          { id: 'a34', n: 34, type: 'choice', label: 'Are incentives primarily based on lagging outcomes or leading behaviors?',
            options: ['Lagging outcomes', 'Leading behaviors', 'Both', 'Not defined'] },
          rate10('a35', 35, 'Can managers consistently explain what a driver must do to earn recognition?'),
          { id: 'a36', n: 36, type: 'choice', scaleLike: true, label: 'How frequently do drivers receive reinforcement for doing the right thing when no incident occurs?', options: CADENCE },
          { id: 'a37', n: 37, type: 'text', label: 'Do current incentives reach most drivers, or mainly a small group of top performers?' },
          { id: 'a38', n: 38, type: 'text', label: 'How are preventable incidents, unsafe trends, coaching, and improvement connected to recognition today?' },
          { id: 'a39', n: 39, type: 'choice', label: 'Would leadership value team challenges or location-based goals in addition to individual recognition?',
            options: ['No', 'Possibly', 'Yes', 'Unsure'] },
          rate10('a40', 40, 'How important is it to change day-to-day driving behavior rather than only celebrate end results?'),
          { id: 'a41', n: 41, type: 'text', label: 'What measurable improvement would make leadership call a rewards program successful after one year?' }
        ]
      },
      {
        title: 'Driver Voice and Reward Relevance',
        questions: [
          { id: 'a42', n: 42, type: 'text', label: 'How are drivers currently asked what forms of recognition they value?' },
          { id: 'a43', n: 43, type: 'choice', label: 'Do drivers receive choice, or does the company select one item for everyone?',
            options: ['Company selects', 'Limited choice', 'Broad choice', 'Depends on event'] },
          rate10('a44', 44, 'How well do current rewards reflect differences in age, route type, family needs, interests, and tenure?'),
          { id: 'a45', n: 45, type: 'short', label: 'What percentage of drivers actively participate in the current incentive program?' },
          { id: 'a46', n: 46, type: 'text', label: 'What feedback have drivers given about current gifts, incentives, or awards?' },
          rate10('a47', 47, 'How important is the ability for drivers to save toward a higher-value reward?'),
          rate10('a48', 48, "How important is it for recognition to reach the driver's home or domicile rather than depend on a terminal handoff?"),
          rate10('a49', 49, 'Are recognition opportunities perceived as fair and attainable across route types and locations?')
        ]
      },
      {
        title: 'Administration, Fulfillment, and Governance',
        questions: [
          { id: 'a50', n: 50, type: 'short', label: 'How many people touch the recognition process from approval through delivery?' },
          { id: 'a51', n: 51, type: 'text', label: 'Who sources products, manages branding, collects sizes or addresses, stores inventory, ships items, and handles exceptions?' },
          { id: 'a52', n: 52, type: 'short', label: 'How much internal time is spent each month administering rewards and recognition?' },
          { id: 'a53', n: 53, type: 'choice', label: 'Does the organization purchase minimum quantities or warehouse branded merchandise?',
            options: ['No', 'Sometimes', 'Yes', 'Unsure'] },
          { id: 'a54', n: 54, type: 'choice', scaleLike: true, label: 'How often does branded inventory become obsolete because of logo, acquisition, policy, or workforce changes?',
            options: ['Never', 'Rarely', 'Sometimes', 'Often'] },
          rate10('a55', 55, 'Can leadership see who was recognized, why, when, and at what budget level?'),
          rate10('a56', 56, 'Are recognition rules and approvals consistent across managers and locations?'),
          { id: 'a57', n: 57, type: 'text', label: 'What procurement, tax, compliance, branding, or data-security requirements must a solution satisfy?' },
          rate10('a58', 58, 'Would centralized reporting and fulfillment remove meaningful work from internal teams?')
        ]
      },
      {
        title: 'Leadership Priorities, Budget, and Readiness',
        questions: [
          { id: 'a59', n: 59, type: 'text', label: 'What business problem caused this conversation to become important now?' },
          { id: 'a60', n: 60, type: 'text', label: 'Which leaders must support the solution for it to succeed?' },
          { id: 'a61', n: 61, type: 'text', label: 'Is there an established annual or per-driver recognition budget? If so, how is it allocated today?' },
          { id: 'a62', n: 62, type: 'choice', label: 'Would leadership prefer a defined program budget, event-by-event purchasing, or a combination?',
            options: ['Program budget', 'Event purchases', 'Combination', 'Undecided'] },
          { id: 'a63', n: 63, type: 'choice', label: 'Would the organization prefer to begin with a pilot, one location, one driver group, or a full rollout?',
            options: ['Pilot', 'One location', 'One group', 'Full rollout', 'Undecided'] },
          { id: 'a64', n: 64, type: 'text', label: 'What systems or data sources would need to support the program?' },
          rate10('a65', 65, 'How quickly could leadership define qualifying behaviors, recognition rules, and program ownership?'),
          { id: 'a66', n: 66, type: 'choice', label: 'What implementation timing would be realistic?',
            options: ['0–30 days', '31–90 days', '3–6 months', '6–12 months', 'Exploring only'] },
          { id: 'a67', n: 67, type: 'text', label: 'What concerns could prevent approval or successful adoption?' },
          { id: 'a68', n: 68, type: 'text', label: 'If nothing changes during the next 12 months, what is the likely operational or cultural cost?' },
          { id: 'a69', n: 69, type: 'text', label: 'What would the ideal future driver-recognition experience look and feel like?' }
        ]
      },
      {
        title: 'Closing Alignment',
        questions: [
          { id: 'a70', n: 70, type: 'choice', label: 'Which need feels most urgent: creating memorable recognition moments, reinforcing behavior continuously, or both?',
            options: ['Recognition moments', 'Continuous reinforcement', 'Both', 'Unsure'] },
          { id: 'a71', n: 71, type: 'text', label: 'Which current process should be preserved because it is working well?' },
          { id: 'a72', n: 72, type: 'text', label: 'Which current process should be replaced or improved first?' },
          { id: 'a73', n: 73, type: 'text', label: 'What would you need to see from us to feel confident in a recommendation?' },
          { id: 'a74', n: 74, type: 'text', label: 'Who should participate in the next conversation, and what decision should that meeting produce?' }
        ]
      }
    ]
  };

  /* ══════════════════════════════════════════════════════════════════════════
     3. 2027 DRIVER RECOGNITION COMMITMENT GUIDE — gated decision worksheet
     Not a survey. Leadership marks Commit / Explore / Defer per initiative, names
     an owner and a date per workstream, sizes the retroactive population, then
     records the commitments it will actually advance. The output IS their plan.
     ══════════════════════════════════════════════════════════════════════════ */
  var COMMITMENTS = [
    ['c1',  'Driver of the Year + runners-up', ['Commit', 'Explore', 'Defer'],
      'Begin data collection Jan. 1. Recognize Driver of the Year, first runner-up and second runner-up using a published objective scorecard.'],
    ['c2',  'Rookie of the Year', ['Commit', 'Explore', 'Defer'],
      'One recipient with 6 to under 12 months of service; use a separate rate-normalized scorecard.'],
    ['c3',  'ODNDR culture program', ['Commit', 'Pilot', 'Defer'],
      'Select 3–5 measurable safety or operating behaviors and establish an ongoing recognition cadence.'],
    ['c4',  'Birthday recognition', ['Commit', 'Explore', 'Defer'],
      'Choose one consistent experience, confirm address ownership and establish a monthly fulfillment file.'],
    ['c5',  'Driver Appreciation Week 2027', ['Commit', 'Explore', 'Defer'],
      'Set the experience, budget and delivery model by Q1 — not during the final planning weeks.'],
    ['c6',  'Retirement recognition for retirees', ['Commit', 'Explore', 'Defer'],
      'Establish eligibility and an executive-level presentation experience that honors each retiring driver at the close of service.'],
    ['c7',  'Safety initiative kit', ['Commit', 'Pilot', 'Defer'],
      'Evaluate a practical kit built around a tire thumper, tire-pressure gauge and tread-depth gauge; connect distribution to training.'],
    ['c8',  'Onboarding kits', ['Commit', 'Pilot', 'Defer'],
      'Standardize what every new driver receives and when; target delivery before or during orientation.'],
    ['c9',  'Service milestones', ['Commit', 'Audit', 'Defer'],
      'Confirm tenure milestones, eligibility, award experience, data owner and retroactive recognition policy.'],
    ['c10', 'Safety Recognition Program', ['Commit', 'Pilot', 'Defer'],
      'Recognize verified safe-driving milestones with medals and selected tangible items; define the mileage thresholds, validation source and award cadence.']
  ].map(function (row, i) {
    return { id: row[0], n: i + 1, type: 'choice', label: row[1], options: row[2], help: row[3], decision: true };
  });

  var commitment = {
    key: 'commitment',
    name: '2027 Driver Recognition Commitment Guide',
    shortName: '2027 Commitment Guide',
    eyebrow: 'A leadership decision aid for January 1, 2027',
    heroWord: '2027',
    gated: true,
    audience: 'organization',
    blurb: 'Turn recognition intentions into owned, budgeted and repeatable commitments. Work backward from January 1 — a January launch is achieved through decisions made in 2026.',
    note: 'Decision rule: do not mark an initiative committed until leadership can name the owner, eligible population, budget range, data source and intended launch date.',
    sections: [
      {
        title: 'The Decision List',
        lede: 'Commitments to consider by January 1, 2027.',
        questions: COMMITMENTS
      },
      {
        title: 'The Readiness Path',
        lede: 'Sep–Oct 2026 decide · Nov 2026 design · Dec 2026 prepare · Jan 1, 2027 launch. Name an owner and a target date for each workstream.',
        questions: [
          { id: 'cw', n: 11, type: 'matrix', label: 'Workstream ownership',
            rows: [
              { id: 'gov',   label: 'Program governance', note: 'Eligibility, approvals and budget controls' },
              { id: 'data',  label: 'Driver data',        note: 'Roster, hire date, birthday, address and milestone fields' },
              { id: 'award', label: 'Award measurement',  note: 'Metrics, thresholds and review process' },
              { id: 'ful',   label: 'Fulfillment',        note: 'Ship-to-home, terminal distribution or hybrid' },
              { id: 'comms', label: 'Communications',     note: 'Launch message, manager briefing and driver FAQs' },
              { id: 'rep',   label: 'Reporting',          note: 'Participation, delivery, milestone and recognition records' }
            ],
            cols: [
              { id: 'owner', label: 'Named owner', type: 'text' },
              { id: 'date',  label: 'Target date', type: 'date' }
            ]
          },
          { id: 'c12', n: 12, type: 'text',
            label: 'January 1 readiness test — can the organization explain who qualifies, what happens, who owns it, what it costs and how completion will be verified? Note anything still missing.' }
        ]
      },
      {
        title: 'The Retroactive Census',
        lede: 'How many drivers qualify for milestone recognition? Review the previous 12 months for service and safe-mile milestones below one million miles, and the previous 24 months for one-million-mile and higher achievements. Remove drivers already recognized for the same milestone and confirm active employment before ordering.',
        questions: [
          { id: 'cc', n: 13, type: 'matrix', label: 'Retroactive population', computeEligible: true,
            rows: [
              { id: 'svc',  label: 'Service anniversaries selected by leadership', note: '12-month lookback' },
              { id: 'm250', label: '250,000 safe miles',    note: '12-month lookback' },
              { id: 'm500', label: '500,000 safe miles',    note: '12-month lookback' },
              { id: 'm1',   label: '1,000,000 safe miles',  note: '24-month lookback' },
              { id: 'm2',   label: '2,000,000 safe miles',  note: '24-month lookback' },
              { id: 'm3',   label: '3,000,000+ safe miles', note: '24-month lookback' }
            ],
            cols: [
              { id: 'crossed',    label: 'Crossed threshold', type: 'number' },
              { id: 'recognized', label: 'Already recognized', type: 'number' },
              { id: 'eligible',   label: 'Eligible total', type: 'computed' }
            ]
          },
          { id: 'c14', n: 14, type: 'multi', label: 'Which driver data can you pull for the lookback?',
            options: ['Driver name', 'Employee ID', 'Active status', 'Hire date', 'Verified safe miles', 'Prior recognition record'] },
          { id: 'c15', n: 15, type: 'text',
            label: 'How does the organization define safe miles? (Odometer totals, company-safe miles and career-safe miles are not automatically interchangeable — validate before counting.)' }
        ]
      },
      {
        title: 'The Leadership Commitment',
        lede: 'What will drivers be able to count on in 2027? Record the priorities leadership agrees to advance after reviewing the guide.',
        questions: [
          { id: 'cl', n: 16, type: 'matrix', label: 'Agreed commitments',
            rows: [
              { id: 'r1', label: 'Commitment 1' }, { id: 'r2', label: 'Commitment 2' },
              { id: 'r3', label: 'Commitment 3' }, { id: 'r4', label: 'Commitment 4' },
              { id: 'r5', label: 'Commitment 5' }
            ],
            cols: [
              { id: 'what',  label: 'Commitment',      type: 'text' },
              { id: 'owner', label: 'Executive owner', type: 'text' },
              { id: 'date',  label: 'Target date',     type: 'date' }
            ]
          },
          { id: 'c17', n: 17, type: 'text', label: 'Questions for your ODNDR / DAS representative' }
        ]
      }
    ]
  };

  /* ── Registry + helpers shared by client and server ──────────────────────── */
  var ALL = { driver: driver, assessment: assessment, commitment: commitment };

  /** Flat list of every question in an instrument, in order. */
  function questions(key) {
    var inst = ALL[key];
    if (!inst) return [];
    return inst.sections.reduce(function (acc, s) {
      return acc.concat(s.questions.map(function (q) {
        return Object.assign({}, q, { section: s.title });
      }));
    }, []);
  }

  /** Question lookup by id — how the server turns a posted id back into its text. */
  function byId(key) {
    return questions(key).reduce(function (m, q) { m[q.id] = q; return m; }, {});
  }

  return {
    instruments: ALL,
    order: ['driver', 'assessment', 'commitment'],
    get: function (k) { return ALL[k] || null; },
    questions: questions,
    byId: byId
  };
});
