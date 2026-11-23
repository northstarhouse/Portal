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
    { k: 'phys_name', label: 'Physician name', type: 'text' },
    { k: 'phys_addr', label: 'Address', type: 'text' },
    { k: 'phys_phone', label: 'Phone', type: 'tel' },
    { k: 'phys_init', label: 'I have read the physician designation form (initial)', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/physician-designation.pdf', req: true },
  ] },
  { id: 'chiro', title: 'Designation of Personal Chiropractor or Acupuncturist (DWC 9783.1)', intro: 'The same choice for a chiropractor or acupuncturist.', fields: [
    { k: 'chiro_none', label: 'I do not have a personal chiropractor or acupuncturist to designate', type: 'check' },
    { k: 'chiro_name', label: 'Name', type: 'text' },
    { k: 'chiro_addr', label: 'Address', type: 'text' },
    { k: 'chiro_phone', label: 'Phone', type: 'tel' },
    { k: 'chiro_init', label: 'I have read the chiropractor or acupuncturist designation form (initial)', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/chiropractor-designation.pdf', req: true },
  ] },
  { id: 'deposit', title: 'Direct Deposit Authorization', intro: 'Your paycheck is deposited into this account. Only HR can see these details.', fields: [
    { k: 'dd_name', label: 'Name on the account', type: 'text', req: true },
    { k: 'dd_bank', label: 'Bank name', type: 'text', req: true },
    { k: 'dd_type', label: 'Account type', type: 'select', options: ['Checking', 'Savings'], req: true },
    { k: 'dd_routing', label: 'Routing number (9 digits)', type: 'text', req: true },
    { k: 'dd_account', label: 'Account number', type: 'text', req: true },
    { k: 'dd_auth', label: 'I authorize North Star House to deposit my pay into this account and to correct any errors.', type: 'check', req: true },
  ] },
  { id: 'returned', title: 'Forms to Return', intro: 'Complete each form with HR using the official link, then initial it here. Social Security numbers are never entered in this packet.', fields: [
    { k: 'ret_i9', label: 'I-9, Employment Eligibility Verification', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/i-9.pdf', req: true },
    { k: 'ret_w4', label: 'W-4, Federal Withholding', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/w-4.pdf', req: true },
    { k: 'ret_de4', label: 'DE 4, California Withholding', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/de-4.pdf', req: true },
  ] },
  { id: 'received', title: 'Notices Received', intro: 'Read each notice, then initial to confirm you received it.', fields: [
    { k: 'rec_wchire', label: 'Workers’ Compensation Time of Hire notice', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/workers-comp-time-of-hire.pdf', req: true },
    { k: 'rec_wc', label: 'Workers’ Compensation employee fact sheet', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/workers-comp-fact-sheet.pdf', req: true },
    { k: 'rec_de2320', label: 'DE 2320, For Your Benefit (Disability Insurance, Paid Family Leave and Unemployment)', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/de-2320.pdf', req: true },
    { k: 'rec_de2511', label: 'DE 2511, Paid Family Leave', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/de-2511.pdf', req: true },
    { k: 'rec_wage', label: 'Wage Theft Prevention Act notice (Labor Code 2810.5)', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/wage-notice.pdf', req: true },
    { k: 'rec_conduct', label: 'Code of Conduct', type: 'initials', req: true },
  ] },
  { id: 'policies', title: 'Policies Read', intro: 'Initial each policy to confirm you have read it.', fields: [
    { k: 'pol_harass', label: 'Harassment prevention policy', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/harassment-policy.pdf', req: true },
    { k: 'pol_sexual', label: 'Sexual harassment fact sheet', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/sexual-harassment-fact-sheet.pdf', req: true },
    { k: 'pol_lactation', label: 'Lactation accommodation policy', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/lactation-policy.pdf', req: true },
    { k: 'pol_leave', label: 'Leave policies', type: 'initials', req: true },
    { k: 'pol_dv', label: 'Domestic violence rights notice', type: 'initials', link: 'https://volunteerhub.northstarhouse.org/onboarding/domestic-violence-leave-notice.pdf', req: true },
  ] },
  { id: 'sign', title: 'Acknowledgment and Signature', intro: 'By typing your full name you sign this packet.', fields: [
    { k: 'ack', label: 'I have received the North Star House policies and notices listed above, and the information I entered is true and complete.', type: 'check', req: true },
    { k: 'sig_name', label: 'Signature (type your full name)', type: 'sig', req: true },
    { k: 'sig_date', label: 'Date', type: 'date', req: true },
  ] },
];

export function missingRequired(data) {
  const out = [];
  PACKET_SECTIONS.forEach(s => s.fields.forEach(f => {
    if (!f.req) return;
    if (s.id === 'physician' && f.k !== 'phys_init') return;
    const v = data[f.k];
    if (f.type === 'check' ? !v : !String(v || '').trim()) out.push(f.label);
  }));
  const needPhys = !data.phys_none && !String(data.phys_name || '').trim();
  const needChiro = !data.chiro_none && !String(data.chiro_name || '').trim();
  if (needPhys) out.push('Physician name (or check that you have none)');
  if (needChiro) out.push('Chiropractor or acupuncturist name (or check that you have none)');
  return out;
}
