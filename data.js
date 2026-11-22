/* Afterink demo data. Every supplier, contract and invoice here is invented.
   Contract text uses [[field|quote]] markers: the loader strips them and keeps the
   quote as that field's source, so seeded provenance is verbatim by construction. */
window.AFTERINK = (function () {
  const DEMO_TODAY = '2026-11-17';

  const FIELDS = [
    { k: 'effective', label: 'Effective date', type: 'date' },
    { k: 'termEnd', label: 'Current term ends', type: 'date', crit: true },
    { k: 'autoRenew', label: 'Renews automatically', type: 'bool', crit: true },
    { k: 'renewalMonths', label: 'Renewal term (months)', type: 'num' },
    { k: 'noticeDays', label: 'Notice needed to stop renewal (days)', type: 'num', crit: true },
    { k: 'upliftText', label: 'Price change rule', type: 'text' },
    { k: 'upliftPct', label: 'Largest allowed increase (%)', type: 'num', crit: true },
    { k: 'annualValue', label: 'Annual value (USD)', type: 'money' },
    { k: 'paymentDays', label: 'Payment terms (days)', type: 'num' },
    { k: 'sla', label: 'Service levels and credits', type: 'text' },
    { k: 'liabilityCap', label: 'Liability cap', type: 'text' },
    { k: 'noticeMethod', label: 'How notice must be given', type: 'text' },
    { k: 'law', label: 'Governing law', type: 'text' },
    { k: 'surchargeCapPct', label: 'Surcharge cap (%)', type: 'num', opt: true },
    { k: 'overtimeMultiplier', label: 'Overtime multiplier', type: 'num', opt: true }
  ];

  const CATEGORIES = ['Software', 'Logistics', 'Facilities', 'Marketing', 'Consulting', 'IT infrastructure', 'HR services', 'Security', 'Telecom', 'Staffing', 'Catering', 'Other'];

  const SEED_CONTRACTS = [
    {
      id: 'C-1001', supplier: 'Cloudmetric Inc.', title: 'Subscription Agreement, Order Form No. 1', type: 'SaaS order form', category: 'Software',
      owner: 'Data & Analytics',
      f: { effective: '2025-02-01', termEnd: '2027-01-31', autoRenew: true, renewalMonths: 12, noticeDays: 60, upliftText: 'Lesser of 5% or CPI on each renewal', upliftPct: 5, annualValue: 186000, paymentDays: 30, sla: '99.9% availability. 5% credit per 0.1% shortfall, up to 25%. Claim within 30 days.', liabilityCap: 'Fees paid in the prior 12 months (both parties)', noticeMethod: 'Email renewals@cloudmetric.example, copy the account executive', law: 'Delaware' },
      rates: [{ item: 'Analytics Enterprise seat', unit: 'seat / year', rate: 465 }],
      signals: [
        { tone: 'warn', label: 'Seat usage (single sign-on, last 90 days)', value: '212 of 400 seats active' },
        { tone: 'good', label: 'Availability (status page)', value: 'Met 99.9% in 12 of 12 months' }
      ],
      hint: { rec: 'renegotiate', headline: 'Give notice to protect the position, then renew for about 250 seats.', why: ['Only 212 of 400 seats were active in the last 90 days, so about 47% of the fee buys nothing.', 'Seats can be reduced only at renewal and only by notice before the 2 December deadline (§6).', 'The service itself has met its availability target every month, so there is no reason to leave.'], asks: ['Reduce to 250 seats at the current USD 465 per seat', 'Hold the price flat for the renewal term instead of the 5% or CPI increase', 'Add the right to reduce seats once mid-term'] },
      src: `CLOUDMETRIC SUBSCRIPTION AGREEMENT
ORDER FORM NO. 1

This Order Form is entered into between Cloudmetric Inc. ("Cloudmetric") and Kestrel Mobility Ltd. ("Customer") and is governed by the Cloudmetric Master Subscription Agreement.

1. Subscription. Cloudmetric Analytics Enterprise, 400 named-user seats.

2. Term. [[effective|The Subscription Term begins on 1 February 2025]] and [[termEnd|continues for an initial term of twenty-four (24) months, ending 31 January 2027]].

3. Renewal. [[autoRenew,renewalMonths|This Order Form renews automatically for successive twelve (12) month terms]] unless [[noticeDays|either party gives written notice of non-renewal at least sixty (60) days before the end of the then-current term]].

4. Fees. [[annualValue,rates|Customer shall pay USD 186,000 per year (USD 465 per seat)]], invoiced annually in advance. [[paymentDays|Invoices are payable net thirty (30) days]].

5. Price changes. [[upliftText,upliftPct|On each renewal, Cloudmetric may increase fees by no more than the lesser of five percent (5%) or the change in CPI over the preceding twelve months]].

6. Seat reductions. Customer may reduce seats only at renewal, by written notice given on or before the non-renewal notice deadline.

7. Service levels. [[sla|Cloudmetric will maintain 99.9% monthly availability. If availability falls below 99.9%, Customer may claim a service credit of 5% of the monthly fee for each 0.1% shortfall, up to 25%, provided the claim is made within thirty (30) days of month end]].

8. Liability. [[liabilityCap|Each party's total liability is limited to the fees paid in the twelve (12) months preceding the claim]].

9. Notices. [[noticeMethod|Notices of non-renewal must be sent by email to renewals@cloudmetric.example with a copy to the account executive]].

10. Governing law. [[law|This Order Form is governed by the laws of the State of Delaware]].`
    },
    {
      id: 'C-1002', supplier: 'Fleetline Logistics LLC', title: 'Transportation Services Agreement', type: 'Services agreement', category: 'Logistics',
      owner: 'Supply Chain',
      f: { effective: '2025-04-01', termEnd: '2028-03-31', autoRenew: false, renewalMonths: null, noticeDays: null, upliftText: 'Rates fixed for the term unless amended in writing', upliftPct: 0, annualValue: 1420000, paymentDays: 45, sla: '96% on-time delivery each month. 2% credit on line-haul charges per full point below, up to 10%.', liabilityCap: 'USD 250,000 per incident for loss or damage to goods', noticeMethod: 'Courier to registered office, copy by email to contracts@fleetline.example', law: 'New York', surchargeCapPct: null },
      notes: { annualValue: 'From the purchase order history, not stated in the contract.', surchargeCapPct: 'No cap. The carrier sets the surcharge each month.' },
      rates: [{ item: 'Standard pallet line-haul', unit: 'pallet', rate: 38 }, { item: 'Expedited pallet', unit: 'pallet', rate: 61 }],
      slaCredit: { metric: 'On-time delivery', target: 96, creditPct: 2, perPoint: true, maxPct: 10, unit: '%' },
      perf: { '2026-09': 96.8, '2026-10': 94.6 },
      signals: [{ tone: 'warn', label: 'On-time delivery (warehouse system, October 2026)', value: '94.6% against a 96% target' }],
      src: `TRANSPORTATION SERVICES AGREEMENT

Between Fleetline Logistics LLC ("Carrier") and Kestrel Mobility Ltd. ("Shipper").

1. Term. [[effective|This Agreement takes effect on 1 April 2025]] and [[termEnd|remains in force for three (3) years, until 31 March 2028]]. [[autoRenew|It may be extended only by written agreement signed by both parties]].

2. Services. Carrier will provide palletised line-haul transport between Shipper's distribution centres and service depots.

3. Rates. [[rates|Standard pallet line-haul: USD 38.00 per pallet. Expedited pallet (next-day): USD 61.00 per pallet]]. [[upliftText,upliftPct|Rates are fixed for the Term unless amended in writing]].

4. Fuel surcharge. [[surchargeCapPct|Carrier may apply a fuel surcharge as a percentage of line-haul charges, at the rate Carrier publishes each month]].

5. Service level. [[sla|Carrier will achieve on-time delivery of at least 96% of pallets each calendar month. For each full percentage point below 96%, Shipper is entitled to a credit of 2% of that month's line-haul charges, up to 10%]].

6. Invoicing. Carrier will invoice monthly in arrears. [[paymentDays|Undisputed amounts are payable within forty-five (45) days of receipt]]. Shipper may withhold amounts disputed in good faith.

7. Liability. [[liabilityCap|Carrier's liability for loss of or damage to goods is limited to USD 250,000 per incident]].

8. Termination. Either party may terminate for convenience on one hundred and eighty (180) days' written notice.

9. Notices. [[noticeMethod|Notices must be in writing and delivered by courier to the registered office, with a copy by email to contracts@fleetline.example]].

10. Governing law. [[law|This Agreement is governed by the laws of the State of New York]].`
    },
    {
      id: 'C-1003', supplier: 'BrightClean Facilities Services Ltd.', title: 'Facilities Services Agreement', type: 'Services agreement', category: 'Facilities',
      owner: 'Workplace',
      f: { effective: '2024-07-01', termEnd: '2027-06-30', autoRenew: true, renewalMonths: 12, noticeDays: 90, upliftText: 'Monthly fee fixed for the initial term', upliftPct: 0, annualValue: 498000, paymentDays: 30, sla: 'Joint monthly audit. Score below 90% earns a 5% credit on that month\'s fee, applied on the next invoice.', liabilityCap: '150% of the fees payable in the contract year', noticeMethod: 'Recorded post and email to accounts@brightclean.example', law: 'England and Wales' },
      notes: { annualValue: 'Derived: USD 41,500 a month for 12 months.' },
      rates: [{ item: 'Monthly service fee', unit: 'month', rate: 41500 }],
      slaCredit: { metric: 'Monthly audit score', target: 90, creditPct: 5, unit: '%' },
      perf: { '2026-08': 91, '2026-09': 88, '2026-10': 86 },
      signals: [{ tone: 'warn', label: 'Audit score (joint audit log)', value: 'Below 90% in September (88%) and October (86%)' }],
      hint: { rec: 'renegotiate', headline: 'Keep the supplier but use the audit record to reset the terms.', why: ['Audit scores fell below the 90% target in two of the last three months.', 'The 5% credit is small against the cost of a missed standard and is not being applied without a chase.', 'Renewal is automatic for 12 months unless notice is given by 1 April 2027.'], asks: ['Raise the credit to 10% for a second miss in any rolling three months', 'Apply credits automatically on the next invoice with the audit score shown', 'Hold the monthly fee flat for the renewal period'] },
      src: `FACILITIES SERVICES AGREEMENT

Between BrightClean Facilities Services Ltd. ("Contractor") and Kestrel Mobility Ltd. ("Client").

1. Services. Daily cleaning, waste handling and consumables supply at Client's six sites listed in Schedule 1.

2. Term. [[effective|This Agreement starts on 1 July 2024]] [[termEnd|for an initial term of three (3) years ending 30 June 2027]].

3. Renewal. [[autoRenew,renewalMonths|After the initial term this Agreement continues for further periods of twelve (12) months]] unless [[noticeDays|either party gives at least ninety (90) days' written notice before the end of the current period]].

4. Fees. [[rates,annualValue|Client will pay a monthly service fee of USD 41,500 covering all six sites]]. [[upliftText,upliftPct|The monthly service fee is fixed for the initial term]].

5. Payment. [[paymentDays|Invoices are payable within thirty (30) days of the invoice date]].

6. Quality audits. [[sla|The parties will carry out a joint monthly audit. If the audit score for a month is below 90%, Contractor will credit 5% of that month's service fee on the next invoice]].

7. Liability. [[liabilityCap|Contractor's total liability in any contract year is limited to 150% of the fees payable in that year]].

8. Notices. [[noticeMethod|Notices must be sent by recorded post to the address above and by email to accounts@brightclean.example]].

9. Governing law. [[law|This Agreement is governed by the laws of England and Wales]].`
    },
    {
      id: 'C-1004', supplier: 'Signalpost Software Inc.', title: 'Marketing Automation Order Form', type: 'SaaS order form', category: 'Software',
      owner: 'Marketing',
      f: { effective: '2024-10-01', termEnd: '2027-09-30', autoRenew: true, renewalMonths: 12, noticeDays: 45, upliftText: 'Renewal fees may not exceed the prior term by more than 4%', upliftPct: 4, annualValue: 103833.6, paymentDays: 30, sla: '99.5% monthly uptime target. No service credits.', liabilityCap: 'Fees paid in the 6 months before the claim', noticeMethod: 'Admin console or email to cancel@signalpost.example', law: 'California' },
      notes: { termEnd: 'Derived: 12-month initial term plus two automatic renewals.', annualValue: 'Derived: the most the supplier may charge for the current term (USD 99,840 plus 4%).' },
      rates: [{ item: 'Annual subscription, renewal term from 1 October 2026', unit: 'year', rate: 103833.6, note: 'Prior-term fee USD 99,840 plus the 4% cap in §5' }],
      history: [{ date: '2025-10-01', text: 'Renewed automatically. No decision on record.' }, { date: '2026-10-01', text: 'Renewed automatically. No decision on record. The 17 August notice date passed unseen.' }],
      signals: [{ tone: 'crit', label: 'Renewal history', value: 'Renewed twice with no recorded decision' }],
      src: `SIGNALPOST ORDER FORM

Customer: Kestrel Mobility Ltd. Provider: Signalpost Software Inc.

1. Product. Signalpost Marketing Automation, Growth plan, up to 500,000 contacts.

2. Term. [[effective|Start date: 1 October 2024]]. [[termEnd|Initial term: twelve (12) months]].

3. Renewal. [[autoRenew,renewalMonths|This Order Form renews automatically for successive twelve (12) month terms]] unless [[noticeDays|Customer gives notice of non-renewal at least forty-five (45) days before the renewal date]].

4. Fees. [[annualValue|Annual subscription fee for the initial term: USD 96,000]], invoiced annually in advance. [[paymentDays|Payment is due thirty (30) days from invoice]].

5. Renewal pricing. [[upliftText,upliftPct,rates|Fees for any renewal term will not exceed the fees for the preceding term by more than four percent (4%)]].

6. Service level. [[sla|Provider targets 99.5% monthly uptime. No service credits apply]].

7. Liability. [[liabilityCap|Provider's aggregate liability is limited to the fees paid in the six (6) months before the claim]].

8. Notices. [[noticeMethod|Non-renewal notices must be submitted through the Signalpost admin console or by email to cancel@signalpost.example]].

9. Governing law. [[law|This Order Form is governed by the laws of the State of California]].`
    },
    {
      id: 'C-1005', supplier: 'Orbis Consulting Partners LLP', title: 'Statement of Work No. 3, ERP Programme Advisory', type: 'Statement of work', category: 'Consulting',
      owner: 'Finance Transformation',
      f: { effective: '2026-01-15', termEnd: '2027-01-14', autoRenew: false, renewalMonths: null, noticeDays: null, upliftText: 'Rates fixed. Expenses capped at 8% of fees.', upliftPct: 0, annualValue: 850000, paymentDays: 30, sla: 'Milestones in Schedule A. 10% of fees for a milestone may be withheld until acceptance.', liabilityCap: 'Fees paid under this statement of work', noticeMethod: null, law: 'England and Wales' },
      notes: { noticeMethod: 'Not stated in the statement of work. The master agreement would govern.' },
      rates: [{ item: 'Partner', unit: 'hour', rate: 420 }, { item: 'Manager', unit: 'hour', rate: 290 }, { item: 'Consultant', unit: 'hour', rate: 195 }],
      signals: [
        { tone: 'warn', label: 'Fees invoiced to date (ledger)', value: 'USD 782,000 of the USD 850,000 cap (92%)' },
        { tone: 'crit', label: 'Programme plan', value: 'Go-live moved to March 2027, two months after this work ends' }
      ],
      hint: { rec: 'renegotiate', headline: 'Agree a change order now. Work will otherwise run past the end date with no contract and no cap.', why: ['The statement of work ends on 14 January 2027 and does not renew (§1).', 'Go-live has moved to March 2027, so the team will still be working after the end date.', 'Fees are at 92% of the USD 850,000 cap, and going over it needs written approval (§3).'], asks: ['A change order to 31 March 2027 at the current hourly rates', 'A new fixed cap for the extension, tied to the remaining milestones', 'Keep the 10% retention until go-live is accepted'] },
      src: `STATEMENT OF WORK NO. 3
ERP PROGRAMME ADVISORY

Under the Master Services Agreement between Orbis Consulting Partners LLP ("Consultant") and Kestrel Mobility Ltd. ("Client").

1. Period. [[effective|Services begin on 15 January 2026]] and [[termEnd|end on 14 January 2027]]. [[autoRenew|This Statement of Work does not renew. Any extension requires a signed change order]].

2. Rates. [[rates,upliftPct|Partner: USD 420 per hour. Manager: USD 290 per hour. Consultant: USD 195 per hour]].

3. Fee cap. [[annualValue|Total fees under this Statement of Work will not exceed USD 850,000 without Client's prior written approval]].

4. Expenses. [[upliftText|Reasonable travel expenses are reimbursed at cost, capped at eight percent (8%) of fees invoiced]].

5. Payment. [[paymentDays|Invoices are issued monthly and payable within thirty (30) days]].

6. Deliverables. [[sla|Consultant will deliver the milestones in Schedule A. Client may withhold 10% of fees for a milestone until it is accepted]].

7. Liability. [[liabilityCap|Consultant's liability is limited to the fees paid under this Statement of Work]].

8. Governing law. [[law|This Statement of Work is governed by the laws of England and Wales]].`
    },
    {
      id: 'C-1006', supplier: 'Northlight Creative Ltd.', title: 'Agency Retainer Agreement', type: 'Retainer agreement', category: 'Marketing',
      owner: 'Brand & Communications',
      f: { effective: '2026-03-01', termEnd: '2027-02-28', autoRenew: true, renewalMonths: 12, noticeDays: 90, upliftText: 'Retainer rises 6% on renewal', upliftPct: 6, annualValue: 384000, paymentDays: 14, sla: 'Monthly content plan by the fifth working day. No credits for late delivery.', liabilityCap: 'None. Neither party limits its liability.', noticeMethod: 'Email to the nominated account director, effective next working day', law: 'England and Wales' },
      notes: { annualValue: 'Derived: USD 32,000 a month for 12 months.' },
      rates: [{ item: 'Monthly retainer', unit: 'month', rate: 32000 }, { item: 'Additional work', unit: 'hour', rate: 165 }],
      signals: [
        { tone: 'warn', label: 'Content plans (marketing tracker)', value: 'Late in 3 of the last 6 months' },
        { tone: 'warn', label: 'Additional work billed this year (ledger)', value: 'USD 41,250 outside the retainer' }
      ],
      hint: { rec: 'renegotiate', headline: 'Serve notice by 30 November, then renew on changed terms.', why: ['The retainer rises 6% on renewal (§5), which adds USD 23,040 a year.', 'Content plans were late in 3 of the last 6 months and the contract gives no credit for that (§7).', 'USD 41,250 of additional work suggests the retainer scope no longer matches the need.'], asks: ['Fold the recurring additional work into the retainer scope at no increase', 'Add a 5% credit for a late monthly plan', 'Move payment terms from 14 to 30 days'] },
      src: `AGENCY RETAINER AGREEMENT

Between Northlight Creative Ltd. ("Agency") and Kestrel Mobility Ltd. ("Client").

1. Term. [[effective|This Agreement commences on 1 March 2026]] [[termEnd|for a period of twelve (12) months, to 28 February 2027]].

2. Renewal. [[autoRenew,renewalMonths|The Agreement renews for a further twelve (12) months on each anniversary]] unless [[noticeDays|either party serves written notice not less than ninety (90) days before the anniversary]].

3. Retainer. [[rates,annualValue|Client will pay a monthly retainer of USD 32,000 for the scope in Schedule 1]].

4. Additional work. Work outside Schedule 1 is charged at USD 165 per hour and requires Client's written approval before it starts.

5. Fee review. [[upliftText,upliftPct|On renewal the monthly retainer increases by six percent (6%)]].

6. Payment. [[paymentDays|Invoices are payable within fourteen (14) days]].

7. Delivery. [[sla|Agency will deliver each monthly content plan by the fifth working day of the month. No credits apply for late delivery]].

8. Liability. [[liabilityCap|Neither party limits its liability under this Agreement]].

9. Notices. [[noticeMethod|Notices must be sent by email to the other party's nominated account director and are effective on the next working day]].

10. Governing law. [[law|This Agreement is governed by the laws of England and Wales]].`
    },
    {
      id: 'C-1007', supplier: 'Vaultline Data Centers Inc.', title: 'Colocation Services Agreement', type: 'Services agreement', category: 'IT infrastructure',
      owner: 'Infrastructure',
      f: { effective: '2024-07-01', termEnd: '2027-06-30', autoRenew: true, renewalMonths: 24, noticeDays: 180, upliftText: '5% increase at the start of each renewal term', upliftPct: 5, annualValue: 612000, paymentDays: 30, sla: '99.95% power availability. 10% credit per hour of outage, up to 50%.', liabilityCap: 'Charges paid in the 6 months before the event', noticeMethod: 'Registered mail to Vaultline Legal, 400 Meridian Way, Ashburn, Virginia', law: 'Virginia' },
      notes: { annualValue: 'Derived: USD 51,000 a month for 12 months.' },
      rates: [{ item: 'Monthly recurring charge', unit: 'month', rate: 51000 }],
      signals: [
        { tone: 'crit', label: 'IT roadmap', value: 'Workloads move to public cloud by September 2027' },
        { tone: 'good', label: 'Power availability (supplier reports)', value: 'Met in every month of the term' }
      ],
      hint: { rec: 'exit', headline: 'Give notice. A 24-month renewal would outlast the need by about 21 months.', why: ['Renewal locks in a further 24 months (§3), and leaving early costs 75% of the remaining charges (§7).', 'The IT roadmap moves these workloads to public cloud by September 2027.', 'Notice must reach Vaultline by registered mail at least 180 days before 30 June 2027, so the last safe date is 1 January 2027 (§9).'], asks: ['A short extension to 30 September 2027 on a month-to-month basis', 'No 5% increase for the extension period', 'Written confirmation that notice was received'] },
      src: `COLOCATION SERVICES AGREEMENT

Between Vaultline Data Centers Inc. ("Vaultline") and Kestrel Mobility Ltd. ("Customer").

1. Services. Forty (40) racks, power and cross-connects at Vaultline's Ashburn facility.

2. Term. [[effective|The service commencement date is 1 July 2024]]. [[termEnd|The initial term is thirty-six (36) months and ends on 30 June 2027]].

3. Renewal. [[autoRenew,renewalMonths|The Agreement renews automatically for additional terms of twenty-four (24) months]] unless [[noticeDays|Customer gives written notice at least one hundred and eighty (180) days before the term ends]].

4. Charges. [[rates,annualValue|Monthly recurring charge: USD 51,000]]. [[upliftText,upliftPct|Vaultline may increase the monthly recurring charge by five percent (5%) at the start of each renewal term]].

5. Payment. [[paymentDays|Charges are payable within thirty (30) days of invoice]].

6. Service level. [[sla|Vaultline guarantees 99.95% power availability each month. Customer receives a credit of 10% of the monthly recurring charge for each hour of outage, up to 50%]].

7. Early termination. If Customer terminates during a renewal term, Customer must pay 75% of the remaining charges.

8. Liability. [[liabilityCap|Vaultline's liability is limited to the charges paid in the six (6) months before the event]].

9. Notices. [[noticeMethod|Notice of non-renewal must be sent by registered mail to Vaultline Legal, 400 Meridian Way, Ashburn, Virginia]].

10. Governing law. [[law|This Agreement is governed by the laws of the Commonwealth of Virginia]].`
    },
    {
      id: 'C-1008', supplier: 'Paywise HR Solutions Inc.', title: 'Payroll Services Agreement', type: 'Services agreement', category: 'HR services',
      owner: 'People Operations',
      f: { effective: '2025-03-01', termEnd: '2027-02-28', autoRenew: true, renewalMonths: 12, noticeDays: 30, upliftText: 'Per-employee fee may rise by CPI each 1 March. No cap.', upliftPct: null, annualValue: 266400, paymentDays: 15, sla: 'Payslip error rate below 0.5%. 10% credit on the month\'s fees if exceeded.', liabilityCap: 'Fees paid in the prior 3 months, except for data protection breaches', noticeMethod: 'Email to legal@paywise.example', law: 'Illinois' },
      notes: { annualValue: 'Derived: USD 7.40 for 3,000 employees for 12 months.', upliftPct: 'No cap. The increase follows CPI, whatever CPI is.' },
      rates: [{ item: 'Per active employee', unit: 'employee / month', rate: 7.4 }],
      signals: [
        { tone: 'good', label: 'Payslip error rate (payroll reports)', value: '0.2% average, inside the 0.5% limit' },
        { tone: 'warn', label: 'Headcount plan', value: '3,000 today, 3,600 planned by end of 2027' }
      ],
      hint: { rec: 'renew', headline: 'Renew, and use the growth in headcount to ask for a price cap.', why: ['Error rates average 0.2%, well inside the 0.5% limit (§6).', 'Changing payroll provider mid-growth carries more risk than the fee justifies.', 'The CPI adjustment has no cap (§4), and the fee already grows with headcount.'], asks: ['Cap the annual adjustment at 3%', 'A volume tier once headcount passes 3,300'] },
      src: `PAYROLL SERVICES AGREEMENT

Between Paywise HR Solutions Inc. ("Paywise") and Kestrel Mobility Ltd. ("Client").

1. Term. [[effective|This Agreement is effective from 1 March 2025]] [[termEnd|for an initial term of twenty-four (24) months, expiring 28 February 2027]].

2. Renewal. [[autoRenew,renewalMonths|It then renews for consecutive twelve (12) month terms]] unless [[noticeDays|a party gives thirty (30) days' written notice before expiry]].

3. Fees. [[rates|Client will pay USD 7.40 per active employee per month]]. Fees are calculated on the number of employees paid in the month.

4. Annual adjustment. [[upliftText,upliftPct|Paywise may adjust the per-employee fee each 1 March by the change in CPI]].

5. Payment. [[paymentDays|Fees are collected by direct debit fifteen (15) days after invoice]].

6. Accuracy. [[sla|Paywise will process each payroll with an error rate below 0.5% of payslips. If the error rate is exceeded in a month, Paywise will credit 10% of that month's fees]].

7. Data protection. Paywise processes employee personal data under the Data Processing Addendum in Schedule 3.

8. Liability. [[liabilityCap|Paywise's liability is limited to the fees paid in the three (3) months before the claim, except for breach of Schedule 3]].

9. Notices. [[noticeMethod|Notices must be sent by email to legal@paywise.example]].

10. Governing law. [[law|This Agreement is governed by the laws of the State of Illinois]].`
    },
    {
      id: 'C-1009', supplier: 'Harborview Security Services Ltd.', title: 'Security Services Agreement', type: 'Services agreement', category: 'Security',
      owner: 'Workplace',
      f: { effective: '2025-09-01', termEnd: '2027-08-31', autoRenew: false, renewalMonths: null, noticeDays: null, upliftText: 'Rates fixed for the term', upliftPct: 0, annualValue: 540000, paymentDays: 30, sla: '98% of scheduled shifts filled each month. Hourly rate deducted for every unfilled hour.', liabilityCap: 'USD 2,000,000 per claim', noticeMethod: 'Email to contracts@harborview.example', law: 'England and Wales' },
      notes: { annualValue: 'From the purchase order history, not stated in the contract.' },
      rates: [{ item: 'Security officer', unit: 'hour', rate: 28.5 }, { item: 'Site supervisor', unit: 'hour', rate: 36 }],
      signals: [],
      src: `SECURITY SERVICES AGREEMENT

Between Harborview Security Services Ltd. ("Provider") and Kestrel Mobility Ltd. ("Client").

1. Term. [[effective|This Agreement starts on 1 September 2025]] and [[termEnd|runs for two (2) years, until 31 August 2027]]. [[autoRenew|There is no automatic renewal]].

2. Services. Manned guarding at Client's head office and two depots, 24 hours a day.

3. Rates. [[rates|Security officer: USD 28.50 per hour. Site supervisor: USD 36.00 per hour]]. [[upliftText,upliftPct|Rates are fixed for the Term]].

4. Payment. [[paymentDays|Invoices are payable within thirty (30) days]].

5. Service level. [[sla|Provider will fill at least 98% of scheduled shifts each month. Client may deduct the hourly rate for every unfilled hour]].

6. Liability. [[liabilityCap|Provider's liability is limited to USD 2,000,000 per claim]].

7. Termination. Client may terminate on sixty (60) days' written notice.

8. Notices. [[noticeMethod|Notices must be sent by email to contracts@harborview.example]].

9. Governing law. [[law|This Agreement is governed by the laws of England and Wales]].`
    },
    {
      id: 'C-1010', supplier: 'Corvid Telecom Inc.', title: 'Enterprise Connectivity Service Order', type: 'Service order', category: 'Telecom',
      owner: 'Infrastructure',
      f: { effective: '2023-12-01', termEnd: '2026-11-30', autoRenew: true, renewalMonths: 12, noticeDays: 90, upliftText: 'Charges rise 5% on each renewal', upliftPct: 5, annualValue: 228000, paymentDays: 30, sla: '99.9% availability per site per month. 5% credit on the site\'s monthly charge per failure.', liabilityCap: '12 months of charges', noticeMethod: 'Email to enterprise-notices@corvid.example', law: 'Texas' },
      notes: { annualValue: 'Derived: USD 19,000 a month for 12 months.' },
      rates: [{ item: 'Monthly charge', unit: 'month', rate: 19000 }],
      signals: [{ tone: 'crit', label: 'Notice deadline', value: 'Passed on 1 September 2026 with no decision recorded' }],
      hint: { rec: 'renegotiate', headline: 'The right to stop this renewal has gone. Ask anyway, before 1 December.', why: ['Notice was due 90 days before 30 November 2026, which was 1 September (§3). Nobody saw the date.', 'The order renews for 12 months on 1 December with a 5% increase (§4), adding USD 11,400.', 'A supplier will often trade the increase for a longer commitment, but only if asked before the new term starts.'], asks: ['Waive the 5% increase for the renewal term', 'Shorten the notice period to 30 days from now on', 'Review the 14 sites: two depots closed in 2026'] },
      src: `ENTERPRISE CONNECTIVITY SERVICE ORDER

Between Corvid Telecom Inc. ("Corvid") and Kestrel Mobility Ltd. ("Customer").

1. Services. Managed SD-WAN and dedicated internet access at fourteen (14) Customer sites.

2. Term. [[effective|Service term begins 1 December 2023]] [[termEnd|and runs for thirty-six (36) months, to 30 November 2026]].

3. Renewal. [[autoRenew,renewalMonths|The service order renews automatically for twelve (12) month periods]] unless [[noticeDays|Customer notifies Corvid in writing at least ninety (90) days before the end of the term]].

4. Charges. [[rates,annualValue|Monthly charge: USD 19,000]]. [[upliftText,upliftPct|Charges increase by five percent (5%) on each renewal]].

5. Payment. [[paymentDays|Invoices are due within thirty (30) days]].

6. Service level. [[sla|Corvid targets 99.9% network availability per site per month, with a credit of 5% of the site's monthly charge for each failure]].

7. Liability. [[liabilityCap|Corvid's liability is limited to twelve (12) months of charges]].

8. Notices. [[noticeMethod|Notices must be sent by email to enterprise-notices@corvid.example]].

9. Governing law. [[law|This service order is governed by the laws of the State of Texas]].`
    }
  ];

  /* Signed documents that exist but were never filed. `saved` holds the values of an earlier
     AI reading so the flow still works where live Claude is not available. */
  const SEED_INBOX = [
    {
      id: 'D-1', filename: 'Fleetline_Amendment_2_signed.pdf', found: 'Email attachment in the procurement mailbox, 22 September 2026', owner: 'Supply Chain',
      saved: {
        docType: 'amendment', supplier: 'Fleetline Logistics LLC', title: 'Amendment No. 2 to Transportation Services Agreement', type: 'Amendment', category: 'Logistics',
        summary: 'Lowers the standard pallet rate and caps the fuel surcharge from 1 October 2026, in return for a minimum volume.',
        risks: ['New obligation on Kestrel: at least 20,000 pallets per contract year (§4). The base agreement had no volume commitment.'],
        amends: { parentSupplier: 'Fleetline Logistics', effectiveFrom: '2026-10-01', effKey: 'effectiveFrom', changes: [
          { kind: 'rate', item: 'Standard pallet line-haul', newRate: 35.5, qk: 'rate1' },
          { kind: 'field', field: 'surchargeCapPct', label: 'Fuel surcharge cap (%)', newValue: 6, qk: 'cap' }
        ] }
      },
      src: `AMENDMENT NO. 2 TO TRANSPORTATION SERVICES AGREEMENT

This Amendment No. 2 is made between Fleetline Logistics LLC ("Carrier") and Kestrel Mobility Ltd. ("Shipper") and amends the Transportation Services Agreement dated 1 April 2025 (the "Agreement").

1. Effective date. [[effectiveFrom|This Amendment takes effect on 1 October 2026]].

2. Rates. Clause 3 of the Agreement is amended so that [[rate1|the Standard pallet line-haul rate is USD 35.50 per pallet]]. The Expedited pallet rate is unchanged.

3. Fuel surcharge. Clause 4 of the Agreement is replaced with: "[[cap|The fuel surcharge will not exceed six percent (6%) of line-haul charges in any month]]."

4. Volume commitment. In return, Shipper commits to a minimum of 20,000 pallets per contract year.

5. All other terms of the Agreement remain in full force.

Signed for Fleetline Logistics LLC and Kestrel Mobility Ltd. on 22 September 2026.`
    },
    {
      id: 'D-2', filename: 'Talentbridge Staffing Agreement (executed).docx', found: 'Shared drive, Engineering / Vendors / 2026', owner: 'Engineering',
      saved: {
        docType: 'contract', supplier: 'Talentbridge Staffing Inc.', title: 'Staffing Services Agreement', type: 'Staffing agreement', category: 'Staffing',
        summary: 'Contract developers and testers at fixed hourly bill rates. Renews each year unless stopped with 60 days\' notice.',
        risks: ['Overtime is billable only with written approval in advance (§4). Nothing records those approvals today.', 'A 15% conversion fee applies if a contractor is hired within six months (§5).'],
        values: {
          effective: ['2026-05-01', 'high'], termEnd: ['2027-04-30', 'high'], autoRenew: [true, 'high'], renewalMonths: [12, 'high'], noticeDays: [60, 'high'],
          upliftText: ['Bill rates change only by signed amendment', 'high'], upliftPct: [0, 'medium', 'Interpreted: no increase without a signed amendment. The contract gives no percentage.'],
          annualValue: [null, 'low', 'Not stated. Spend depends on hours billed. Finance estimate from invoices so far: about USD 1,100,000 a year.'],
          paymentDays: [30, 'high'], sla: ['Free replacement of a rejected contractor within the first 10 working days', 'high'],
          liabilityCap: ['Fees paid in the preceding 12 months', 'high'], noticeMethod: ['Email to legal@talentbridge.example', 'high'], law: ['New York', 'high'],
          overtimeMultiplier: [1.25, 'high']
        },
        rates: [{ item: 'Senior Developer', unit: 'hour', rate: 85 }, { item: 'QA Analyst', unit: 'hour', rate: 58 }, { item: 'Project Coordinator', unit: 'hour', rate: 46 }]
      },
      src: `STAFFING SERVICES AGREEMENT

Between Talentbridge Staffing Inc. ("Agency") and Kestrel Mobility Ltd. ("Client").

1. Term. [[effective|This Agreement begins on 1 May 2026]] and [[termEnd|continues for twelve (12) months, until 30 April 2027]].

2. Renewal. [[autoRenew,renewalMonths|It renews automatically for further twelve (12) month terms]] unless [[noticeDays|either party gives sixty (60) days' written notice before the term ends]].

3. Bill rates. [[rates|Senior Developer: USD 85.00 per hour. QA Analyst: USD 58.00 per hour. Project Coordinator: USD 46.00 per hour]]. [[upliftText,upliftPct|Bill rates may be changed only by a written amendment signed by both parties]].

4. Overtime. [[overtimeMultiplier|Hours above forty (40) in a week are billed at 1.25 times the bill rate and only where Client approved the overtime in writing in advance]].

5. Conversion. If Client hires a contractor within six (6) months of placement, Client will pay 15% of the contractor's first-year base salary.

6. Payment. [[paymentDays|Invoices are issued monthly and payable within thirty (30) days]].

7. Replacement. [[sla|Agency will replace any contractor Client rejects within the first ten (10) working days at no charge]].

8. Liability. [[liabilityCap|Agency's liability is limited to the fees paid in the preceding twelve (12) months]].

9. Notices. [[noticeMethod|Notices must be sent by email to legal@talentbridge.example]].

10. Governing law. [[law|This Agreement is governed by the laws of the State of New York]].`
    },
    {
      id: 'D-3', filename: 'scan_greenleaf_letter.pdf', found: 'Scanned letter in the Workplace team folder', owner: 'Workplace',
      saved: {
        docType: 'contract', supplier: 'Greenleaf Catering Co.', title: 'Canteen Services Letter', type: 'Letter agreement', category: 'Catering',
        summary: 'A two-page letter for running the staff canteen at a price per meal. It leaves most commercial protections unstated.',
        risks: ['Price increases have no cap and need no agreement (§2).', 'The notice period is "reasonable notice", with no number of days (§3).', 'No liability clause and no governing law.'],
        values: {
          effective: ['2025-01-06', 'high'], termEnd: ['2027-01-05', 'low', 'No end date is written. The letter runs year to year from 6 January, so the next anniversary is an interpretation.'],
          autoRenew: [true, 'medium', 'The letter says it "carries on from year to year". That works like automatic renewal.'], renewalMonths: [12, 'medium'],
          noticeDays: [null, 'low', 'The letter says "reasonable notice" and gives no number of days.'],
          upliftText: ['Supplier may pass on increases in food costs', 'high'], upliftPct: [null, 'low', 'No cap is stated.'],
          annualValue: [null, 'low', 'Not stated. Depends on meals served.'], paymentDays: [0, 'medium', '"Due on receipt".'],
          sla: [null, 'low', 'No service level is stated.'], liabilityCap: [null, 'low', 'Not stated. Only the supplier\'s insurance cover is mentioned.'],
          noticeMethod: ['In writing', 'medium'], law: [null, 'low', 'Not stated.']
        },
        rates: [{ item: 'Meal served', unit: 'meal', rate: 11.75 }]
      },
      src: `GREENLEAF CATERING
SERVICES LETTER

To: Kestrel Mobility Ltd., Workplace Team

Thank you for choosing Greenleaf Catering Co. This letter sets out what we agreed.

1. We will run the staff canteen at your head office on working days [[effective|from 6 January 2025]].

2. [[rates|You will pay us USD 11.75 per meal served]], invoiced weekly. We will review prices with you from time to time [[upliftText|and may pass on increases in food costs]].

3. [[autoRenew,renewalMonths|This arrangement carries on from year to year until one of us ends it]]. [[noticeDays,noticeMethod|Either of us can end it by giving reasonable notice in writing]].

4. [[paymentDays|Our invoices are due on receipt]].

5. We hold public liability insurance of USD 5,000,000.

Signed: Greenleaf Catering Co. and Kestrel Mobility Ltd., 18 December 2024.`
    }
  ];

  const SEED_INVOICES = [
    { id: 'FL-20931', supplier: 'Fleetline Logistics LLC', date: '2026-11-03', period: '2026-10', periodLabel: 'October 2026', termsDays: 45, total: 94585.96,
      lines: [
        { desc: 'Standard pallet line-haul, 2,140 pallets', kind: 'rate', item: 'Standard pallet line-haul', qty: 2140, unitPrice: 38, amount: 81320, base: true },
        { desc: 'Expedited pallet, 96 pallets', kind: 'rate', item: 'Expedited pallet', qty: 96, unitPrice: 61, amount: 5856, base: true },
        { desc: 'Fuel surcharge, 8.5% of line-haul', kind: 'surcharge', pct: 8.5, amount: 7409.96 }
      ] },
    { id: 'TB-5521', supplier: 'Talentbridge Staffing Inc.', date: '2026-11-05', period: '2026-10', periodLabel: 'October 2026', termsDays: 30, total: 168128,
      lines: [
        { desc: 'Senior Developer, 1,280 hours', kind: 'rate', item: 'Senior Developer', qty: 1280, unitPrice: 92, amount: 117760, base: true },
        { desc: 'QA Analyst, 640 hours', kind: 'rate', item: 'QA Analyst', qty: 640, unitPrice: 58, amount: 37120, base: true },
        { desc: 'Senior Developer overtime, 96 hours', kind: 'rate', item: 'Senior Developer', overtime: true, qty: 96, unitPrice: 138, amount: 13248, base: true }
      ] },
    { id: 'SP-3310', supplier: 'Signalpost Software Inc.', date: '2026-10-01', period: '2026-10', periodLabel: 'Renewal term from 1 October 2026', termsDays: 30, total: 108825.6,
      lines: [
        { desc: 'Marketing Automation Growth plan, annual subscription', kind: 'rate', item: 'Annual subscription, renewal term from 1 October 2026', qty: 1, unitPrice: 108825.6, amount: 108825.6, base: true }
      ] },
    { id: 'BC-1187', supplier: 'BrightClean Facilities Services Ltd.', date: '2026-11-02', period: '2026-10', periodLabel: 'October 2026', termsDays: 30, total: 41500, creditApplied: false,
      lines: [
        { desc: 'Monthly service fee, six sites', kind: 'rate', item: 'Monthly service fee', qty: 1, unitPrice: 41500, amount: 41500, base: true }
      ] },
    { id: 'HV-0992', supplier: 'Harborview Security Services Ltd.', date: '2026-11-02', period: '2026-10', periodLabel: 'October 2026', termsDays: 30, total: 89712,
      lines: [
        { desc: 'Security officer, 2,208 hours', kind: 'rate', item: 'Security officer', qty: 2208, unitPrice: 28.5, amount: 62928, base: true },
        { desc: 'Site supervisor, 744 hours', kind: 'rate', item: 'Site supervisor', qty: 744, unitPrice: 36, amount: 26784, base: true }
      ] }
  ];

  const SAMPLE_INVOICE_TEXT = `HARBORVIEW SECURITY SERVICES LTD
INVOICE HV-1014
Bill to: Kestrel Mobility Ltd.
Invoice date: 16 November 2026    Period: 1 to 15 November 2026

Security officers      1,080 hrs x $29.75      $32,130.00
Site supervisors         360 hrs x $36.00      $12,960.00

Total due: $45,090.00
Payment terms: 14 days`;

  const SUGGESTED = [
    { id: 'q1', q: 'Which contracts have a notice deadline in the next 90 days, and what do we have to do to stop each one renewing?' },
    { id: 'q2', q: 'Which suppliers can raise their prices without any cap?' },
    { id: 'q3', q: 'What are we owed when BrightClean misses its audit score?' },
    { id: 'q4', q: 'Where is a supplier\'s liability limited to less than 12 months of fees?' }
  ];

  /* A fresh contract for "Read a document of your own". It is not in the repository and has no
     saved reading, so what the viewer sees is a genuine live extraction with the code checks. */
  const SAMPLE_CONTRACT_TEXT = `MASTER SUBSCRIPTION AGREEMENT

This Master Subscription Agreement (the "Agreement") is made on 1 March 2026 between Northgate Telematics Inc., a Delaware corporation with offices at 410 Harbor Way, Oakland, California ("Northgate"), and Kestrel Mobility Ltd. ("Customer").

1. Services. Northgate will provide Customer with access to the Northgate fleet tracking platform, the driver safety module and related professional services (together, the "Services") as described in Order Form No. NT-2026-0117, which forms part of this Agreement.

2. Term. This Agreement takes effect on 1 March 2026 (the "Effective Date"). The initial subscription term runs for twenty-four (24) months and ends on 28 February 2028. At the end of the initial term and of each renewal term, this Agreement renews automatically for successive periods of twelve (12) months unless either party gives written notice of non-renewal at least ninety (90) days before the end of the then-current term.

3. Fees. Customer will pay the fees set out in the Order Form: USD 14.00 per enrolled vehicle per month for the fleet tracking subscription, USD 6.50 per enrolled vehicle per month for the driver safety module, and USD 185.00 per hour for professional services ordered in writing. Based on the 1,200 vehicles enrolled at the Effective Date, the annual subscription fees are USD 295,200.00. Fees for the initial term are fixed. At each renewal, Northgate may increase the subscription fees by no more than four percent (4%) over the fees in effect during the preceding term, on sixty (60) days' written notice.

4. Invoicing and payment. Northgate invoices subscription fees quarterly in advance and professional services monthly in arrears. Customer will pay each undisputed invoice within forty-five (45) days of the invoice date. Customer may withhold payment of any amount disputed in good faith, provided it notifies Northgate in writing of the dispute before the due date.

5. Service levels. Northgate will make the platform available at least 99.5% of the time in each calendar month, excluding scheduled maintenance notified at least 48 hours in advance. If availability in a month falls below 99.5%, Customer is entitled to a service credit of five percent (5%) of that month's subscription fees for each full percentage point below 99.5%, up to a maximum credit of twenty percent (20%) of that month's subscription fees. Credits are applied to the next invoice and are Customer's sole remedy for unavailability.

6. Data. Customer owns all vehicle, driver and location data entered into or generated by the Services. Northgate may use aggregated and anonymised data to improve the Services. On termination, Northgate will make Customer data available for export for sixty (60) days and will then delete it.

7. Confidentiality. Each party will keep the other's confidential information in confidence and use it only to perform this Agreement, for the term and for three (3) years afterwards.

8. Warranties. Northgate warrants that the Services will perform materially in accordance with the documentation. Customer's remedy for breach of this warranty is repair, replacement or, if Northgate cannot cure the breach within thirty (30) days, termination and a refund of prepaid fees for the unexpired term.

9. Limitation of liability. Except for breach of confidentiality, infringement indemnities and amounts payable under clause 3, each party's total liability arising out of this Agreement in any contract year is limited to the fees paid or payable by Customer in the twelve (12) months before the event giving rise to the claim. Neither party is liable for indirect or consequential loss, or for loss of profit, revenue or data.

10. Termination. Either party may terminate this Agreement on thirty (30) days' written notice if the other party commits a material breach and fails to cure it within that period. Customer may terminate for convenience at the end of the initial term by giving the notice described in clause 2.

11. Notices. Notices under this Agreement must be in writing and sent by email to legal@kestrelmobility.example and contracts@northgate.example, with a copy by registered post to the addresses above. A notice is deemed received on the next business day after sending.

12. Governing law. This Agreement is governed by the laws of England and Wales, and the courts of England have exclusive jurisdiction.

Signed for Northgate Telematics Inc. by Dana Whitfield, VP Sales, and for Kestrel Mobility Ltd. by Priya Raman, Head of Procurement, on 1 March 2026.`;

  return { DEMO_TODAY, FIELDS, CATEGORIES, SEED_CONTRACTS, SEED_INBOX, SEED_INVOICES, SAMPLE_INVOICE_TEXT, SAMPLE_CONTRACT_TEXT, SUGGESTED };
})();
