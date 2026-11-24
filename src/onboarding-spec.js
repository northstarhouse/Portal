// What is in the staff onboarding packet. The same file is kept in the Volunteer Hub (src/lib/onboarding-spec.js):
// the Hub renders it as a fill-in form, the Portal renders the filled-in answers for HR to review and print.
// Field types: text, tel, select, initials (typed initials), check, sig (typed full name), date.
export const PACKET_SECTIONS = [
  { id: 'emergency', title: 'Emergency Contact', intro: 'Who should we call if something happens to you at work?', fields: [
    { k: 'ec1_name', label: 'Primary contact name', type: 'text', req: true },
    { k: 'ec1_rel', label: 'Relationship', type: 'text', req: true },
    { k: 'ec1_phone', label: 'Phone', type: 'tel', req: true },
    { k: 'ec1_alt', label: 'Alternate phone', type: 'tel' },
    { k: 'ec2_name', label: 'Second contact name', type: 'text' },
    { k: 'ec2_rel', label: 'Relationship', type: 'text' },
    { k: 'ec2_phone', label: 'Phone', type: 'tel' },
    { k: 'ec_medical', label: 'Allergies or medical conditions we should know about (optional)', type: 'text' },
  ] },
  { id: 'physician', title: 'Designation of Personal Physician (DWC 9783)', intro: 'If you are injured at work, you may choose to be treated by your personal physician. Name them here, or choose that you have none.', fields: [
    { k: 'phys_none', label: 'I do not have a personal physician to designate', type: 'check' },
    { k: 'phys_form', label: 'Fill out the Designation of Personal Physician form (DWC 9783)', type: 'form', link: 'https://volunteerhub.northstarhouse.org/onboarding/physician-designation.pdf', fill: true },
  ] },
  { id: 'chiro', title: 'Designation of Personal Chiropractor or Acupuncturist (DWC 9783.1)', intro: 'The same choice for a chiropractor or acupuncturist.', fields: [
    { k: 'chiro_none', label: 'I do not have a personal chiropractor or acupuncturist to designate', type: 'check' },
    { k: 'chiro_form', label: 'Fill out the Designation of Personal Chiropractor or Acupuncturist form (DWC 9783.1)', type: 'form', link: 'https://volunteerhub.northstarhouse.org/onboarding/chiropractor-designation.pdf', fill: true },
  ] },
  { id: 'returned', title: 'Forms to Return', intro: 'Fill out each form right here on the page. Your answers are saved to your packet. Only HR can see them.', fields: [
    { k: 'ret_i9', label: 'I-9, Employment Eligibility Verification', type: 'form', link: 'https://volunteerhub.northstarhouse.org/onboarding/i-9.pdf', fill: true, req: true },
    { k: 'ret_wage', label: 'Wage & Employment Notice to Employees (DLSE-NTE, Labor Code 2810.5)', type: 'form', prefill: {
      text: {
        'Legal Name of Hiring Employer': 'North Star Historic Conservancy',
        'Physical Address of Hiring Employers Main Office': 'North Star House',
        'Hiring Employers Mailing Address if different than above': '12075 Auburn Road, Grass Valley, CA, 95949',
        'undefined': 'PO Box 1538 Grass Valley, CA 95945',
        'Hiring Employers Telephone Number': '530-477-7126',
        'Regular Payday': '1st & 16th',
      },
      radio: { 'Professional Employer Organization PEO': 'No', 'check box': 'Yes_2', 'undefined_2': 'Yes_3' },
      lock: ['Legal Name of Hiring Employer', 'Professional Employer Organization PEO', 'Physical Address of Hiring Employers Main Office', 'Hiring Employers Mailing Address if different than above', 'undefined', 'Hiring Employers Telephone Number', 'check box', 'undefined_2', 'If the employee has signed the acknowledgment of receipt below it does not constitute a voluntary written agreement as', 'Regular Payday', 'Name', 'Physical Address of Main Office', 'Mailing Address', 'Telephone Number'],
      // North Star is not a staffing agency, so the "other entity" box is locked and grayed out.
      gray: ['Name', 'Physical Address of Main Office', 'Mailing Address', 'Telephone Number'],
    }, link: 'https://volunteerhub.northstarhouse.org/onboarding/wage-notice.pdf', fill: true, req: true },
    { k: 'ret_w4', label: 'W-4, Federal Withholding', type: 'form', link: 'https://volunteerhub.northstarhouse.org/onboarding/w-4.pdf', fill: true, req: true },
    { k: 'ret_de4', label: 'DE 4, California Withholding', type: 'form', link: 'https://volunteerhub.northstarhouse.org/onboarding/de-4.pdf', fill: true, req: true },
  ] },
  { id: 'received', group: 'View Documents', title: 'Notices Received', intro: 'Read each notice, then initial to confirm you received it.', fields: [
    { k: 'rec_wchire', label: 'Workers’ Compensation Time of Hire notice', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/workers-comp-time-of-hire.pdf', req: true },
    { k: 'rec_wc', label: 'Workers’ Compensation employee fact sheet', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/workers-comp-fact-sheet.pdf', req: true },
    { k: 'rec_family', label: 'Family Care, Medical Leave and Pregnancy Disability Leave Fact Sheet (CRD-100)', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/family-care-medical-leave-pdl.pdf', req: true },
    { k: 'rec_family_crd', label: 'Family Care and Medical Leave Fact Sheet, Civil Rights Department (CRD-E03P)', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/family-care-medical-leave-fact-sheet.pdf', req: true },
    { k: 'rec_de2320_pfl', label: 'Paid Family Leave (DE 2320)', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/de-2320.pdf', req: true },
    { k: 'rec_de2320_sdi', label: 'State Disability Insurance (DE 2320)', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/de-2320.pdf', req: true },
    { k: 'rec_de2320_sui', label: 'State Unemployment Insurance (DE 2320)', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/de-2320.pdf', req: true },
    { k: 'rec_de2511', label: 'DE 2511, Paid Family Leave', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/de-2511.pdf', req: true },
    { k: 'rec_conduct', label: 'NSHC Code of Conduct', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/code-of-conduct.pdf', req: true },
    { k: 'rec_emergency', label: 'Emergency Plan Training (NSH Emergency Information Plan)', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/emergency-information-plan.pdf', req: true },
  ] },
  { id: 'policies', group: 'View Documents', title: 'Policies Read', intro: 'Initial each policy to confirm you have read it.', fields: [
    { k: 'pol_harass', label: 'Harassment prevention policy', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/harassment-policy.pdf', req: true },
    { k: 'pol_sexual', label: 'Sexual Harassment Fact Sheet (CRD-185)', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/sexual-harassment-fact-sheet.pdf', req: true },
    { k: 'pol_lactation', label: 'Lactation Accommodation Policy', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/lactation-policy.pdf', req: true },
    { k: 'pol_dv', label: 'Rights of Victims of Domestic Violence, Sexual Assault and Stalking Notice (Labor Code 230 and 230.1)', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/domestic-violence-leave-notice.pdf', req: true },
  ] },
  { id: 'deposit', title: 'Direct Deposit Authorization', intro: 'Your paycheck is deposited into this account. Only HR can see these details.', fields: [
    { k: 'dd_name', label: 'Name on the account', type: 'text', req: true },
    { k: 'dd_bank', label: 'Bank name', type: 'text', req: true },
    { k: 'dd_type', label: 'Account type', type: 'select', options: ['Checking', 'Savings'], req: true },
    { k: 'dd_routing', label: 'Routing number (9 digits)', type: 'text', req: true },
    { k: 'dd_account', label: 'Account number', type: 'text', req: true },
    { k: 'dd_auth', label: 'I authorize North Star House to deposit my pay into this account and to correct any errors.', type: 'check', req: true },
  ] },
  { id: 'sign', title: 'Acknowledgment', intro: 'Type your full name to sign. After you submit, your supervisor reviews the packet and signs it too.', fields: [
    { k: 'ack', label: 'I have been informed about the topics I initialed and had the opportunity to ask questions. I understand that additional questions should be directed to my supervisor.', type: 'check', req: true },
    { k: 'sig_name', label: 'Employee signature (type your full name)', type: 'sig', req: true },
    { k: 'sig_date', label: 'Date', type: 'date', req: true },
    { k: 'sup_sig', label: 'Supervisor signature and date', type: 'pending' },
  ] },
];

// Filled-in official PDFs are saved separately; the packet remembers which ones are done as data['doc_<field key>'].
export function missingRequired(data) {
  const out = [];
  PACKET_SECTIONS.forEach(s => s.fields.forEach(f => {
    if (!f.req) return;
    if (f.type === 'form') { if (!data['doc_' + f.k] && !data['skip_' + f.k]) out.push('Fill out and save: ' + f.label + ' (or check that you already turned it in)'); return; }
    const v = data[f.k];
    if (f.type === 'check' ? !v : !String(v || '').trim()) out.push(f.label);
  }));
  if (!data.phys_none && !data.doc_phys_form && !data.skip_phys_form) out.push('Physician designation form (or check that you have none)');
  if (!data.chiro_none && !data.doc_chiro_form && !data.skip_chiro_form) out.push('Chiropractor or acupuncturist designation form (or check that you have none)');
  return out;
}
