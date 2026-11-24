import {
  LawLibraryPrecedent,
  LegalDefenseStatementType,
  LegalJurisdictionEntry,
  LegalPracticeArea,
  LegalResearchMode,
  USCodeTitleEntry,
} from '../types';

export interface LegalQuickBriefTemplate {
  id: string;
  domain: Exclude<LegalPracticeArea, 'all' | 'constitutional'>;
  title: string;
  mode: LegalResearchMode;
  defenseStatementType?: LegalDefenseStatementType;
  prompt: string;
}

export interface DefenseStatementPreset {
  id: LegalDefenseStatementType;
  label: string;
  domain: Exclude<LegalPracticeArea, 'all' | 'constitutional'>;
  statutoryBasis: string;
  summary: string;
  defaultPrompt: string;
}

export const LEGAL_DEFENSE_STATEMENT_TEMPLATES: DefenseStatementPreset[] = [
  {
    id: 'cease_and_desist',
    label: 'Cease & Desist + Evidence Preservation Notice',
    domain: 'business',
    statutoryBasis: '18 U.S.C. § 1836 · 15 U.S.C. § 1125 · FRCP Rule 37(e)',
    summary: 'Formal notice demanding immediate cessation of unlawful interference, defamation, breach, or trade-secret misuse plus mandatory litigation hold.',
    defaultPrompt:
      'Draft a formal Cease and Desist and Evidence Preservation Notice on behalf of the Grey House demanding immediate halt to unauthorized interference, false statements, or misuse of confidential assets, and placing the recipient under a strict spoliation/litigation hold.'
  },
  {
    id: 'reservation_of_rights',
    label: 'Reservation of Rights & Non-Waiver Statement',
    domain: 'civil',
    statutoryBasis: 'UCC § 1-308 · Constitutional Due Process · FRCP Rule 12(b)',
    summary: 'Preserves all substantive, jurisdictional, and procedural defenses while refusing implied waiver or accord and satisfaction.',
    defaultPrompt:
      'Draft a formal Notice of Full Reservation of Rights, Non-Waiver, and Jurisdictional Objection under UCC § 1-308 and controlling federal/state procedural rules to protect the Grey House in any disputed demand or proceeding.'
  },
  {
    id: 'sworn_declaration',
    label: 'Declaration Under Penalty of Perjury (28 U.S.C. § 1746)',
    domain: 'civil',
    statutoryBasis: '28 U.S.C. § 1746 · Federal Rules of Evidence',
    summary: 'Court-formatted factual defense declaration asserting verified timeline, good-faith compliance, and statutory standing.',
    defaultPrompt:
      'Draft a formal Sworn/Unsworn Factual Defense Declaration compliant with 28 U.S.C. § 1746 and state declaration statutes setting forth the Grey House factual record, chronological events, and clean verification signature block.'
  },
  {
    id: 'affirmative_defenses',
    label: 'Statement of Statutory Affirmative Defenses',
    domain: 'civil',
    statutoryBasis: 'FRCP Rule 8(c) · State Civil & Penal Defenses',
    summary: 'Structured assertion of statute of limitations, laches, estoppel, privilege, justification, lack of standing, and good-faith immunity.',
    defaultPrompt:
      'Draft a comprehensive Statement of Affirmative Defenses and Protective Legal Posture citing controlling federal/state statutory bars, failure to state a claim, privilege/justification, mitigation, and counter-remedies.'
  },
  {
    id: 'corporate_shield',
    label: 'Corporate Veil, Fiduciary & Asset Shield Resolution',
    domain: 'business',
    statutoryBasis: 'Del. Code tit. 8 & tit. 6 · State LLC Acts',
    summary: 'Establishes corporate separateness, Business Judgment Rule authority, indemnification, and charging-order shield protections for the House.',
    defaultPrompt:
      'Draft a Corporate & Fiduciary Shield Defense Resolution documenting strict entity separateness, officer indemnification rights, Business Judgment Rule compliance, and statutory charging-order protections insulating the Grey House.'
  },
  {
    id: 'property_castle_notice',
    label: 'Premises Security, Quiet Title & Constitutional Defense Statement',
    domain: 'criminal',
    statutoryBasis: 'U.S. Const. amends. IV, V, VI · State Castle & Trespass Codes',
    summary: 'Formal invocation of 4th/5th/6th Amendment rights against warrantless search/questioning plus statutory notice of private property & lawful defense.',
    defaultPrompt:
      'Draft a Grey House Constitutional & Property Defense Statement asserting strict Fourth Amendment non-consent to warrantless searches, Fifth/Sixth Amendment invocation of counsel, and statutory notice against unlawful trespass or interference.'
  },
  {
    id: 'regulatory_response',
    label: 'Professional Licensing & Administrative Cure Statement',
    domain: 'professional',
    statutoryBasis: '5 U.S.C. § 551 et seq. (APA) · State Licensing Codes',
    summary: 'Protective response to professional complaints, board inquiries, or contractual cure demands preserving due process and license standing.',
    defaultPrompt:
      'Draft a formal Protective Response & Administrative Due Process Statement defending professional standing, asserting statutory notice/hearing rights, denying unsubstantiated allegations, and reserving all judicial review remedies.'
  },
  {
    id: 'educator_bureaucracy_shield',
    label: 'Lady Grey Educator & Anti-Bureaucracy Defense Statement',
    domain: 'professional',
    statutoryBasis: '20 U.S.C. §§ 7941–7948 (Coverdell Act) · Loudermill · Garrity · Pickering · 42 U.S.C. § 1983',
    summary: 'Shields Lady Grey as a classroom teacher against hostile school/district bureaucracy, HR directives, coercive investigations, licensing threats, and tort exposure.',
    defaultPrompt:
      'Draft a formal Lady Grey Educator & Anti-Bureaucracy Defense Statement invoking the Paul D. Coverdell Teacher Protection Act (20 U.S.C. §§ 7941–7948), Cleveland Bd. of Educ. v. Loudermill pre-deprivation due process, Garrity v. New Jersey Fifth Amendment anti-coercion protection, Pickering First Amendment protection, Weingarten representative rights, and 42 U.S.C. § 1983 non-retaliation notice against school district or state bureaucracy overreach.'
  }
];

// Complete 54 Titles of the United States Code (Official Office of the Law Revision Counsel structure)
export const US_CODE_TITLES: USCodeTitleEntry[] = [
  { titleNumber: 1, label: 'Title 1 — General Provisions', domain: 'constitutional', summary: 'Rules of construction, statutory definitions, enacting clauses', url: 'https://www.law.cornell.edu/uscode/text/1' },
  { titleNumber: 2, label: 'Title 2 — The Congress', domain: 'constitutional', summary: 'Legislative authority, lobbying disclosure, congressional procedures', url: 'https://www.law.cornell.edu/uscode/text/2' },
  { titleNumber: 3, label: 'Title 3 — The President', domain: 'constitutional', summary: 'Executive powers, delegation of functions, continuity of government', url: 'https://www.law.cornell.edu/uscode/text/3' },
  { titleNumber: 4, label: 'Title 4 — Flag and Seal, Seat of Government, and the States', domain: 'constitutional', summary: 'Interstate compacts, state taxation limitations on federal areas', url: 'https://www.law.cornell.edu/uscode/text/4' },
  { titleNumber: 5, label: 'Title 5 — Government Organization and Employees', domain: 'professional', summary: 'Administrative Procedure Act (APA), FOIA, federal agency rulemaking & ethics', url: 'https://www.law.cornell.edu/uscode/text/5' },
  { titleNumber: 6, label: 'Title 6 — Domestic Security', domain: 'criminal', summary: 'Homeland security statutes, cybersecurity infrastructure & critical asset rules', url: 'https://www.law.cornell.edu/uscode/text/6' },
  { titleNumber: 7, label: 'Title 7 — Agriculture', domain: 'business', summary: 'Commodity Exchange Act, agricultural commodities & trade compliance', url: 'https://www.law.cornell.edu/uscode/text/7' },
  { titleNumber: 8, label: 'Title 8 — Aliens and Nationality', domain: 'civil', summary: 'Immigration & Nationality Act, lawful status, visas, naturalization', url: 'https://www.law.cornell.edu/uscode/text/8' },
  { titleNumber: 9, label: 'Title 9 — Arbitration', domain: 'civil', summary: 'Federal Arbitration Act (FAA), enforceability of arbitration clauses & awards', url: 'https://www.law.cornell.edu/uscode/text/9' },
  { titleNumber: 10, label: 'Title 10 — Armed Forces', domain: 'criminal', summary: 'UCMJ (Uniform Code of Military Justice), defense procurement & jurisdiction', url: 'https://www.law.cornell.edu/uscode/text/10' },
  { titleNumber: 11, label: 'Title 11 — Bankruptcy', domain: 'business', summary: 'Chapters 7, 11, 13 insolvency, automatic stay, creditor priorities & discharge', url: 'https://www.law.cornell.edu/uscode/text/11' },
  { titleNumber: 12, label: 'Title 12 — Banks and Banking', domain: 'business', summary: 'National Bank Act, FDIC, Federal Reserve, RESPA, TILA & financial compliance', url: 'https://www.law.cornell.edu/uscode/text/12' },
  { titleNumber: 13, label: 'Title 13 — Census', domain: 'civil', summary: 'Federal statistical collection & confidentiality protections', url: 'https://www.law.cornell.edu/uscode/text/13' },
  { titleNumber: 14, label: 'Title 14 — Coast Guard', domain: 'criminal', summary: 'Maritime law enforcement, boarding authority & coastal jurisdiction', url: 'https://www.law.cornell.edu/uscode/text/14' },
  { titleNumber: 15, label: 'Title 15 — Commerce and Trade', domain: 'business', summary: 'Sherman/Clayton Antitrust, Securities Acts of 1933/1934, FTC, Lanham Act, FCRA', url: 'https://www.law.cornell.edu/uscode/text/15' },
  { titleNumber: 16, label: 'Title 16 — Conservation', domain: 'civil', summary: 'Endangered Species Act, federal land use, forestry & water power licensing', url: 'https://www.law.cornell.edu/uscode/text/16' },
  { titleNumber: 17, label: 'Title 17 — Copyrights', domain: 'professional', summary: 'Copyright protection, fair use (§ 107), DMCA safe harbors (§ 512), infringement', url: 'https://www.law.cornell.edu/uscode/text/17' },
  { titleNumber: 18, label: 'Title 18 — Crimes and Criminal Procedure', domain: 'criminal', summary: 'Federal penal code, wire/mail fraud, RICO, CFAA, firearms, defense & bail', url: 'https://www.law.cornell.edu/uscode/text/18' },
  { titleNumber: 19, label: 'Title 19 — Customs Duties', domain: 'business', summary: 'Tariff Act, import/export enforcement, customs seizures & trade compliance', url: 'https://www.law.cornell.edu/uscode/text/19' },
  { titleNumber: 20, label: 'Title 20 — Education', domain: 'professional', summary: 'FERPA privacy, Title IX, institutional governance & accreditation', url: 'https://www.law.cornell.edu/uscode/text/20' },
  { titleNumber: 21, label: 'Title 21 — Food and Drugs', domain: 'criminal', summary: 'FDCA, Controlled Substances Act, DEA scheduling & forfeiture provisions', url: 'https://www.law.cornell.edu/uscode/text/21' },
  { titleNumber: 22, label: 'Title 22 — Foreign Relations and Intercourse', domain: 'business', summary: 'FARA, ITAR export controls, diplomatic immunity & foreign sovereigns', url: 'https://www.law.cornell.edu/uscode/text/22' },
  { titleNumber: 23, label: 'Title 23 — Highways', domain: 'civil', summary: 'Federal highway jurisdiction, motor carrier rules & right-of-way compliance', url: 'https://www.law.cornell.edu/uscode/text/23' },
  { titleNumber: 24, label: 'Title 24 — Hospitals and Asylums', domain: 'professional', summary: 'Federal healthcare facilities & statutory oversight', url: 'https://www.law.cornell.edu/uscode/text/24' },
  { titleNumber: 25, label: 'Title 25 — Indians', domain: 'civil', summary: 'Tribal sovereignty, Indian Child Welfare Act, jurisdictional compacts', url: 'https://www.law.cornell.edu/uscode/text/25' },
  { titleNumber: 26, label: 'Title 26 — Internal Revenue Code', domain: 'business', summary: 'Federal income, corporate, estate, trust & payroll tax statutes (IRS Code)', url: 'https://www.law.cornell.edu/uscode/text/26' },
  { titleNumber: 27, label: 'Title 27 — Intoxicating Liquors', domain: 'business', summary: 'Federal alcohol regulation, permitting & interstate distribution', url: 'https://www.law.cornell.edu/uscode/text/27' },
  { titleNumber: 28, label: 'Title 28 — Judiciary and Judicial Procedure', domain: 'civil', summary: 'Federal courts, diversity & federal question jurisdiction, FTCA, venue & fees', url: 'https://www.law.cornell.edu/uscode/text/28' },
  { titleNumber: 29, label: 'Title 29 — Labor', domain: 'professional', summary: 'FLSA, NLRA, OSHA, ERISA fiduciaries, ADEA & FMLA employment law', url: 'https://www.law.cornell.edu/uscode/text/29' },
  { titleNumber: 30, label: 'Title 30 — Mineral Lands and Mining', domain: 'business', summary: 'Mineral rights, subsurface claims, leasing & mine safety', url: 'https://www.law.cornell.edu/uscode/text/30' },
  { titleNumber: 31, label: 'Title 31 — Money and Finance', domain: 'business', summary: 'Bank Secrecy Act, AML, FinCEN reporting, False Claims Act (qui tam)', url: 'https://www.law.cornell.edu/uscode/text/31' },
  { titleNumber: 32, label: 'Title 32 — National Guard', domain: 'constitutional', summary: 'State/federal dual status & domestic deployment authority', url: 'https://www.law.cornell.edu/uscode/text/32' },
  { titleNumber: 33, label: 'Title 33 — Navigation and Navigable Waters', domain: 'civil', summary: 'Clean Water Act, admiralty jurisdiction & maritime liability limits', url: 'https://www.law.cornell.edu/uscode/text/33' },
  { titleNumber: 34, label: 'Title 34 — Crime Control and Law Enforcement', domain: 'criminal', summary: 'Law enforcement grants, DNA indexing, civil rights policing & victims rights', url: 'https://www.law.cornell.edu/uscode/text/34' },
  { titleNumber: 35, label: 'Title 35 — Patents', domain: 'professional', summary: 'USPTO patentability (§ 101–103), infringement, remedies & PTAB review', url: 'https://www.law.cornell.edu/uscode/text/35' },
  { titleNumber: 36, label: 'Title 36 — Patriotic and National Observances', domain: 'civil', summary: 'Federally chartered corporations & nonprofit recognitions', url: 'https://www.law.cornell.edu/uscode/text/36' },
  { titleNumber: 37, label: 'Title 37 — Pay and Allowances of the Uniformed Services', domain: 'professional', summary: 'Military compensation, retirement & statutory entitlements', url: 'https://www.law.cornell.edu/uscode/text/37' },
  { titleNumber: 38, label: 'Title 38 — Veterans Benefits', domain: 'civil', summary: 'VA disability claims, GI Bill, USERRA reemployment rights', url: 'https://www.law.cornell.edu/uscode/text/38' },
  { titleNumber: 39, label: 'Title 39 — Postal Service', domain: 'civil', summary: 'Postal statutes, mailability restrictions & administrative enforcement', url: 'https://www.law.cornell.edu/uscode/text/39' },
  { titleNumber: 40, label: 'Title 40 — Public Buildings, Property, and Works', domain: 'business', summary: 'Federal contracting real property, Miller Act surety bonds', url: 'https://www.law.cornell.edu/uscode/text/40' },
  { titleNumber: 41, label: 'Title 41 — Public Contracts', domain: 'business', summary: 'Federal procurement rules, Contract Disputes Act & government contracting', url: 'https://www.law.cornell.edu/uscode/text/41' },
  { titleNumber: 42, label: 'Title 42 — The Public Health and Welfare', domain: 'civil', summary: 'Civil Rights Act (§ 1983), ADA, Fair Housing Act, HIPAA/Social Security, CERCLA', url: 'https://www.law.cornell.edu/uscode/text/42' },
  { titleNumber: 43, label: 'Title 43 — Public Lands', domain: 'civil', summary: 'BLM land management, easements, patents & federal mineral reservations', url: 'https://www.law.cornell.edu/uscode/text/43' },
  { titleNumber: 44, label: 'Title 44 — Public Printing and Documents', domain: 'professional', summary: 'Federal Register, Presidential Records Act & statutory recordkeeping', url: 'https://www.law.cornell.edu/uscode/text/44' },
  { titleNumber: 45, label: 'Title 45 — Railroads', domain: 'civil', summary: 'FELA carrier liability & Railway Labor Act', url: 'https://www.law.cornell.edu/uscode/text/45' },
  { titleNumber: 46, label: 'Title 46 — Shipping', domain: 'business', summary: 'Admiralty & maritime commerce, Jones Act, vessel liens & carriage', url: 'https://www.law.cornell.edu/uscode/text/46' },
  { titleNumber: 47, label: 'Title 47 — Telecommunications', domain: 'business', summary: 'Communications Act, FCC licensing, Section 230 & TCPA compliance', url: 'https://www.law.cornell.edu/uscode/text/47' },
  { titleNumber: 48, label: 'Title 48 — Territories and Insular Possessions', domain: 'constitutional', summary: 'Governance & federal statutory application in U.S. Territories', url: 'https://www.law.cornell.edu/uscode/text/48' },
  { titleNumber: 49, label: 'Title 49 — Transportation', domain: 'business', summary: 'FAA aviation rules, FMCSA trucking liability & Carmack Amendment', url: 'https://www.law.cornell.edu/uscode/text/49' },
  { titleNumber: 50, label: 'Title 50 — War and National Defense', domain: 'criminal', summary: 'IEEPA sanctions, CFIUS foreign investment, FISA & War Powers', url: 'https://www.law.cornell.edu/uscode/text/50' },
  { titleNumber: 51, label: 'Title 51 — National and Commercial Space Programs', domain: 'business', summary: 'Commercial space launch licensing & aerospace liability', url: 'https://www.law.cornell.edu/uscode/text/51' },
  { titleNumber: 52, label: 'Title 52 — Voting and Elections', domain: 'constitutional', summary: 'Voting Rights Act, FECA campaign finance & federal election compliance', url: 'https://www.law.cornell.edu/uscode/text/52' },
  { titleNumber: 53, label: 'Title 53 — [Reserved]', domain: 'constitutional', summary: 'Reserved title in the United States Code codification plan', url: 'https://uscode.house.gov/' },
  { titleNumber: 54, label: 'Title 54 — National Park Service and Related Programs', domain: 'civil', summary: 'National park protections, historic preservation & permit regulations', url: 'https://www.law.cornell.edu/uscode/text/54' }
];

// Complete U.S. Federal + All 50 States + D.C. + U.S. Territories Jurisdictional Registry
export const US_JURISDICTIONS: LegalJurisdictionEntry[] = [
  { code: 'US-FED', name: 'Federal (United States Code & Constitution)', level: 'federal', officialCodeName: 'U.S. Code (Titles 1–54), CFR, FRCP & FRCrimP', officialUrl: 'https://uscode.house.gov/', statutoryFocus: 'Constitutional supremacy, federal crimes (Title 18), tax (Title 26), commerce & IP' },
  { code: 'AL', name: 'Alabama', level: 'state', officialCodeName: 'Code of Alabama 1975', officialUrl: 'https://alisondb.legislature.state.al.us/alison/codeofalabama/1975/coatoc.htm', statutoryFocus: 'Business Entities (Title 10A), Criminal Code (Title 13A), Civil Practice (Title 6)' },
  { code: 'AK', name: 'Alaska', level: 'state', officialCodeName: 'Alaska Statutes', officialUrl: 'https://www.akleg.gov/basis/statutes.asp', statutoryFocus: 'Asset Protection Trusts, Criminal Code (Title 11), Corporations (Title 10)' },
  { code: 'AZ', name: 'Arizona', level: 'state', officialCodeName: 'Arizona Revised Statutes (A.R.S.)', officialUrl: 'https://www.azleg.gov/arstitle/', statutoryFocus: 'Criminal Code (Title 13), LLC Act (Title 29), Civil Torts & Property (Title 12/33)' },
  { code: 'AR', name: 'Arkansas', level: 'state', officialCodeName: 'Arkansas Code Annotated (A.C.A.)', officialUrl: 'https://advance.lexis.com/container?config=00JAA2ZjZiM2VhNS0wNTVlLTQ3NzUtYjQzYy0yYWZmODJiODRmMDYKAFBvZENhdGFsb2f823R5J4aV85l3M9pE8dZ9&crid=b9288488-74ec-4149-8383-f5760072006f', statutoryFocus: 'Criminal Offenses (Title 5), Business & Commercial Law (Title 4)' },
  { code: 'CA', name: 'California', level: 'state', officialCodeName: 'California Codes (29 Statutory Codes)', officialUrl: 'https://leginfo.legislature.ca.gov/faces/codes.xhtml', statutoryFocus: 'Penal Code, Civil Code, Corporations Code, Labor Code, B&P Code (§ 16600/17200)' },
  { code: 'CO', name: 'Colorado', level: 'state', officialCodeName: 'Colorado Revised Statutes (C.R.S.)', officialUrl: 'https://leg.colorado.gov/colorado-revised-statutes', statutoryFocus: 'Business Entities (Title 7), Criminal Code (Title 18), Courts & Civil Procedure (Title 13)' },
  { code: 'CT', name: 'Connecticut', level: 'state', officialCodeName: 'Connecticut General Statutes', officialUrl: 'https://www.cga.ct.gov/current/pub/titles.htm', statutoryFocus: 'CUTPA Commercial Unfair Trade, Penal Code (Title 53a), Business Corporations (Title 33)' },
  { code: 'DE', name: 'Delaware', level: 'state', officialCodeName: 'Delaware Code (Title 8 DGCL & Title 6 LLC)', officialUrl: 'https://delcode.delaware.gov/', statutoryFocus: 'Title 8 General Corporation Law, Title 6 LLC Act, Court of Chancery fiduciary law' },
  { code: 'FL', name: 'Florida', level: 'state', officialCodeName: 'Florida Statutes', officialUrl: 'https://www.leg.state.fl.us/statutes/', statutoryFocus: 'Ch. 605/607 Business Entities, Ch. 776 Stand Your Ground, Homestead Exemption, Ch. 775 Criminal' },
  { code: 'GA', name: 'Georgia', level: 'state', officialCodeName: 'Official Code of Georgia Annotated (O.C.G.A.)', officialUrl: 'https://www.legis.ga.gov/laws/en-US/default.aspx', statutoryFocus: 'Title 14 Corporations, Title 16 Crimes & Self-Defense, Title 51 Torts' },
  { code: 'HI', name: 'Hawaii', level: 'state', officialCodeName: 'Hawaii Revised Statutes (HRS)', officialUrl: 'https://www.capitol.hawaii.gov/hrscurrent/', statutoryFocus: 'Business Registration (Title 23), Penal Code (Title 37), Real Property & Trusts' },
  { code: 'ID', name: 'Idaho', level: 'state', officialCodeName: 'Idaho Statutes', officialUrl: 'https://legislature.idaho.gov/statutesrules/idstat/', statutoryFocus: 'Criminal Code (Title 18), Business Entities (Title 30), Civil Procedure (Title 5)' },
  { code: 'IL', name: 'Illinois', level: 'state', officialCodeName: 'Illinois Compiled Statutes (ILCS)', officialUrl: 'https://www.ilga.gov/legislation/ilcs/ilcs.asp', statutoryFocus: '720 ILCS Criminal Code, 805 ILCS Business Organizations, 735 ILCS Civil Procedure' },
  { code: 'IN', name: 'Indiana', level: 'state', officialCodeName: 'Indiana Code (IC)', officialUrl: 'https://iga.in.gov/laws/2024/ic/titles/1', statutoryFocus: 'Title 23 Business Organizations, Title 35 Criminal Law, Title 34 Civil Law & Procedure' },
  { code: 'IA', name: 'Iowa', level: 'state', officialCodeName: 'Iowa Code', officialUrl: 'https://www.legis.iowa.gov/law/statutory', statutoryFocus: 'Business Corporations (Ch. 489/490), Criminal Code (Ch. 701–732), Civil Torts' },
  { code: 'KS', name: 'Kansas', level: 'state', officialCodeName: 'Kansas Statutes Annotated (K.S.A.)', officialUrl: 'https://www.kslegislature.org/li/statutes/', statutoryFocus: 'Ch. 17 Corporations, Ch. 21 Criminal Code, Ch. 60 Civil Procedure' },
  { code: 'KY', name: 'Kentucky', level: 'state', officialCodeName: 'Kentucky Revised Statutes (KRS)', officialUrl: 'https://apps.legislature.ky.gov/law/statutes/', statutoryFocus: 'Ch. 271B/275 Business Entities, Penal Code (Ch. 500–534), Civil Limitations' },
  { code: 'LA', name: 'Louisiana', level: 'state', officialCodeName: 'Louisiana Civil Code & Revised Statutes', officialUrl: 'https://www.legis.la.gov/legis/Laws_Toc.aspx?folder=75', statutoryFocus: 'Civil Law Tradition (Napoleonic Civil Code), Title 12 Corporations, Title 14 Criminal Law' },
  { code: 'ME', name: 'Maine', level: 'state', officialCodeName: 'Maine Revised Statutes (M.R.S.)', officialUrl: 'https://legislature.maine.gov/statutes/', statutoryFocus: 'Title 13-C Corporations, Title 17-A Criminal Code, Title 14 Civil Procedure' },
  { code: 'MD', name: 'Maryland', level: 'state', officialCodeName: 'Annotated Code of Maryland', officialUrl: 'https://mgaleg.maryland.gov/mgawebsite/Laws/Statutes', statutoryFocus: 'Corporations & Associations, Criminal Law Article, Courts & Judicial Proceedings' },
  { code: 'MA', name: 'Massachusetts', level: 'state', officialCodeName: 'Massachusetts General Laws (M.G.L.)', officialUrl: 'https://malegislature.gov/Laws/GeneralLaws', statutoryFocus: 'Ch. 93A Consumer/Business Protection, Ch. 156D Business Corp, Ch. 265/266 Crimes' },
  { code: 'MI', name: 'Michigan', level: 'state', officialCodeName: 'Michigan Compiled Laws (MCL)', officialUrl: 'https://www.legislature.mi.gov/Laws/MCL', statutoryFocus: 'Ch. 450 Business Organizations, Ch. 750 Penal Code, Ch. 600 Revised Judicature Act' },
  { code: 'MN', name: 'Minnesota', level: 'state', officialCodeName: 'Minnesota Statutes', officialUrl: 'https://www.revisor.mn.gov/statutes/', statutoryFocus: 'Ch. 302A/322C Business Entities, Ch. 609 Criminal Code, Ch. 541 Civil Limitations' },
  { code: 'MS', name: 'Mississippi', level: 'state', officialCodeName: 'Mississippi Code of 1972 Annotated', officialUrl: 'https://www.lexisnexis.com/hottopics/mscode/', statutoryFocus: 'Title 79 Corporations, Title 97 Crimes, Title 11/15 Civil Practice & Limitations' },
  { code: 'MO', name: 'Missouri', level: 'state', officialCodeName: 'Revised Statutes of Missouri (RSMo)', officialUrl: 'https://revisor.mo.gov/main/Home.aspx', statutoryFocus: 'Ch. 347/351 Business Entities, Title XXXVIII Criminal Code, Castle Doctrine § 563.031' },
  { code: 'MT', name: 'Montana', level: 'state', officialCodeName: 'Montana Code Annotated (MCA)', officialUrl: 'https://leg.mt.gov/bills/mca/index.html', statutoryFocus: 'Title 35 Corporations, Title 45 Crimes, Wrongful Discharge from Employment Act (Title 39)' },
  { code: 'NE', name: 'Nebraska', level: 'state', officialCodeName: 'Nebraska Revised Statutes', officialUrl: 'https://nebraskalegislature.gov/laws/browse-statutes.php', statutoryFocus: 'Ch. 21 Corporations, Ch. 28 Crimes & Punishments, Ch. 25 Civil Procedure' },
  { code: 'NV', name: 'Nevada', level: 'state', officialCodeName: 'Nevada Revised Statutes (NRS)', officialUrl: 'https://www.leg.state.nv.us/NRS/', statutoryFocus: 'Ch. 78 Corporations & Ch. 86 LLC Charging Order Shield, Ch. 166 Spendthrift Trusts, Ch. 193–207 Crimes' },
  { code: 'NH', name: 'New Hampshire', level: 'state', officialCodeName: 'New Hampshire Revised Statutes Annotated (RSA)', officialUrl: 'https://www.gencourt.state.nh.us/rsa/html/nhtoc.htm', statutoryFocus: 'Title XXVII Corporations, Title LXII Criminal Code, Ch. 564-B Uniform Trust Code' },
  { code: 'NJ', name: 'New Jersey', level: 'state', officialCodeName: 'New Jersey Revised Statutes (N.J.S.A.)', officialUrl: 'https://lis.njleg.state.nj.us/nxt/gateway.dll?f=templates&fn=default.htm&vid=Publish:10.1048/Enu', statutoryFocus: 'Title 14A/42 Business Entities, Title 2C Criminal Justice Code, Consumer Fraud Act' },
  { code: 'NM', name: 'New Mexico', level: 'state', officialCodeName: 'New Mexico Statutes Annotated (NMSA 1978)', officialUrl: 'https://nmonesource.com/nmos/nmsa/en/nav.do', statutoryFocus: 'Ch. 53 Corporations, Ch. 30 Criminal Offenses, Civil Rights Act' },
  { code: 'NY', name: 'New York', level: 'state', officialCodeName: 'New York Consolidated Laws', officialUrl: 'https://www.nysenate.gov/legislation/laws/CONSOLIDATED', statutoryFocus: 'BCL, LLC Law, Penal Law, CPLR Civil Practice, General Business Law (Martin Act)' },
  { code: 'NC', name: 'North Carolina', level: 'state', officialCodeName: 'North Carolina General Statutes', officialUrl: 'https://www.ncleg.gov/Laws/GeneralStatutes', statutoryFocus: 'Ch. 55/57D Business Entities, Ch. 14 Criminal Law, Ch. 75 Unfair Trade Practices' },
  { code: 'ND', name: 'North Dakota', level: 'state', officialCodeName: 'North Dakota Century Code (NDCC)', officialUrl: 'https://ndlegis.gov/general-information/north-dakota-century-code', statutoryFocus: 'Title 10 Corporations, Title 12.1 Criminal Code, Oil/Gas & Mineral Property Law' },
  { code: 'OH', name: 'Ohio', level: 'state', officialCodeName: 'Ohio Revised Code (ORC)', officialUrl: 'https://codes.ohio.gov/ohio-revised-code', statutoryFocus: 'Title 17 Corporations & LLCs, Title 29 Crimes & Procedure, Title 23 Civil Actions' },
  { code: 'OK', name: 'Oklahoma', level: 'state', officialCodeName: 'Oklahoma Statutes', officialUrl: 'https://www.oscn.net/applications/oscn/index.asp?ftdb=STOKST', statutoryFocus: 'Title 18 Corporations, Title 21 Crimes & Punishments, Title 12 Civil Procedure' },
  { code: 'OR', name: 'Oregon', level: 'state', officialCodeName: 'Oregon Revised Statutes (ORS)', officialUrl: 'https://www.oregonlegislature.gov/bills_laws/Pages/ORS.aspx', statutoryFocus: 'Ch. 60/63 Business Entities, Ch. 161–167 Criminal Code, Ch. 12–36 Civil Practice' },
  { code: 'PA', name: 'Pennsylvania', level: 'state', officialCodeName: 'Pennsylvania Consolidated Statutes (Pa.C.S.)', officialUrl: 'https://www.legis.state.pa.us/cfdocs/legis/LI/public/cons_index.cfm', statutoryFocus: 'Title 15 Associations Code, Title 18 Crimes Code, Title 42 Judicial Procedure' },
  { code: 'RI', name: 'Rhode Island', level: 'state', officialCodeName: 'Rhode Island General Laws', officialUrl: 'https://webserver.rilegislature.gov/Statutes/', statutoryFocus: 'Title 7 Corporations & Partnerships, Title 11 Criminal Offenses, Title 9 Civil Procedure' },
  { code: 'SC', name: 'South Carolina', level: 'state', officialCodeName: 'South Carolina Code of Laws', officialUrl: 'https://www.scstatehouse.gov/code/statmast.php', statutoryFocus: 'Title 33 Corporations & LLCs, Title 16 Crimes, Title 15 Civil Remedies' },
  { code: 'SD', name: 'South Dakota', level: 'state', officialCodeName: 'South Dakota Codified Laws (SDCL)', officialUrl: 'https://sdlegislature.gov/Statutes', statutoryFocus: 'Title 55 Dynasty & Asset Protection Trusts, Title 47 Corporations, Title 22 Crimes' },
  { code: 'TN', name: 'Tennessee', level: 'state', officialCodeName: 'Tennessee Code Annotated (T.C.A.)', officialUrl: 'https://www.tncourts.gov/Tennessee%20Code', statutoryFocus: 'Title 48 Corporations & LLCs, Title 39 Criminal Offenses, Title 28/29 Civil Remedies' },
  { code: 'TX', name: 'Texas', level: 'state', officialCodeName: 'Texas Constitution and Statutes', officialUrl: 'https://statutes.capitol.texas.gov/', statutoryFocus: 'Business Organizations Code (BOC), Penal Code (Ch. 9 Self-Defense), Civil Practice & Remedies Code' },
  { code: 'UT', name: 'Utah', level: 'state', officialCodeName: 'Utah Code', officialUrl: 'https://le.utah.gov/xcode/code.html', statutoryFocus: 'Title 48 Partnerships/LLCs & Title 16 Corporations, Title 76 Criminal Code, Title 78B Judicial Code' },
  { code: 'VT', name: 'Vermont', level: 'state', officialCodeName: 'Vermont Statutes Annotated (V.S.A.)', officialUrl: 'https://legislature.vermont.gov/statutes/', statutoryFocus: 'Title 11/11A Corporations, Title 13 Crimes & Criminal Procedure, Title 12 Court Procedure' },
  { code: 'VA', name: 'Virginia', level: 'state', officialCodeName: 'Code of Virginia', officialUrl: 'https://law.lis.virginia.gov/vacode', statutoryFocus: 'Title 13.1 Corporations & LLCs, Title 18.2 Crimes & Offenses, Title 8.01 Civil Remedies' },
  { code: 'WA', name: 'Washington', level: 'state', officialCodeName: 'Revised Code of Washington (RCW)', officialUrl: 'https://app.leg.wa.gov/rcw/', statutoryFocus: 'Title 23B/25 Business Entities, Title 9A Washington Criminal Code, Title 4/7 Civil Procedure' },
  { code: 'WV', name: 'West Virginia', level: 'state', officialCodeName: 'West Virginia Code', officialUrl: 'https://code.wvlegislature.gov/', statutoryFocus: 'Ch. 31D/31B Corporations & LLCs, Ch. 61 Crimes, Ch. 55 Actions & Suits' },
  { code: 'WI', name: 'Wisconsin', level: 'state', officialCodeName: 'Wisconsin Statutes', officialUrl: 'https://docs.legis.wisconsin.gov/statutes/prefaces/toc', statutoryFocus: 'Ch. 180/183 Business Entities, Ch. 939–951 Criminal Code, Ch. 801–847 Civil Procedure' },
  { code: 'WY', name: 'Wyoming', level: 'state', officialCodeName: 'Wyoming Statutes Annotated', officialUrl: 'https://www.wyoleg.gov/StateStatutes/StatutesConstitution', statutoryFocus: 'Ch. 17-29 Close LLC & DAO Statutes, Title 6 Crimes, Title 4 Uniform Trust Code' },
  { code: 'DC', name: 'District of Columbia (Washington, D.C.)', level: 'territory', officialCodeName: 'Code of the District of Columbia', officialUrl: 'https://code.dccouncil.gov/', statutoryFocus: 'Title 29 Business Organizations, Title 22 Criminal Offenses, Title 12/16 Civil Actions' },
  { code: 'PR', name: 'Puerto Rico', level: 'territory', officialCodeName: 'Laws of Puerto Rico Annotated (L.P.R.A.)', officialUrl: 'https://bvirtualogp.pr.gov/', statutoryFocus: 'Act 60 Tax Incentives Code, Civil Code 2020, Penal Code Title 33' },
  { code: 'VI', name: 'U.S. Virgin Islands', level: 'territory', officialCodeName: 'Virgin Islands Code Annotated', officialUrl: 'https://www.legvi.org/', statutoryFocus: 'Title 13 Corporations, Title 14 Crimes, Title 5 Civil & Criminal Procedure' }
];

export const LEGAL_QUICK_TEMPLATES: LegalQuickBriefTemplate[] = [
  // Professional
  {
    id: 'prof-fiduciary',
    domain: 'professional',
    title: 'Fiduciary Duty & Officer Liability Shield',
    mode: 'legal_counsel',
    prompt: 'Analyze fiduciary duties of care, loyalty, and good faith for corporate officers, managing members, and licensed professionals, including Business Judgment Rule protection and personal liability triggers.'
  },
  {
    id: 'prof-trade-secrets',
    domain: 'professional',
    title: 'DTSA Trade Secrets & Non-Compete Enforceability',
    mode: 'statute_lookup',
    prompt: 'Cite the Defend Trade Secrets Act (18 U.S.C. § 1836), state UTSA alignment, and current federal/state statutory restrictions on non-compete, non-solicitation, and confidentiality agreements.'
  },
  {
    id: 'prof-malpractice',
    domain: 'professional',
    title: 'Professional Malpractice & Licensing Board Defense',
    mode: 'rights_defense',
    prompt: 'Detail statutory standards of care, administrative due process protections before state licensing boards, mandatory reporting exposures, and malpractice affirmative defenses.'
  },
  {
    id: 'prof-lady-grey-teacher',
    domain: 'professional',
    title: 'Lady Grey: Educator Shield vs. School Bureaucracy',
    mode: 'defense_strategy',
    defenseStatementType: 'educator_bureaucracy_shield',
    prompt: 'Protect Lady Grey in her capacity as a teacher against hostile school administration, district HR bureaucracy, arbitrary PIP/disciplinary directives, or state credentialing scrutiny. Apply the Paul D. Coverdell Teacher Protection Act (20 U.S.C. §§ 7941–7948), Loudermill due process, Garrity anti-coercion immunity, Pickering First Amendment retaliation bars, FERPA limits, and Weingarten representative rights.'
  },
  // Business
  {
    id: 'biz-entity-shield',
    domain: 'business',
    title: 'Delaware vs. Wyoming vs. Nevada LLC & Veil Shield',
    mode: 'state_compare',
    prompt: 'Compare LLC charging-order exclusivity, anonymous ownership protections, fiduciary default rules, and corporate veil-piercing standards under Delaware, Wyoming, and Nevada statutes.'
  },
  {
    id: 'biz-ucc-secured',
    domain: 'business',
    title: 'UCC Article 2 & Article 9 Commercial Lien Law',
    mode: 'statute_lookup',
    prompt: 'Look up Uniform Commercial Code Article 2 (sales, breach, warranties, damages) and Article 9 (security interest attachment, UCC-1 perfection, priority, and default remedies).'
  },
  {
    id: 'biz-securities-compliance',
    domain: 'business',
    title: 'SEC Reg D Private Capital & Contract Breach Remedies',
    mode: 'legal_counsel',
    prompt: 'Analyze statutory requirements for private capital formation under the Securities Act of 1933 (15 U.S.C. § 77d / Reg D), accredited investor rules, and commercial breach remedies (specific performance vs. expectation damages).'
  },
  // Criminal
  {
    id: 'crim-4th-5th-6th',
    domain: 'criminal',
    title: '4th, 5th & 6th Amendment Search & Interrogation Rights',
    mode: 'rights_defense',
    prompt: 'Provide the controlling constitutional and statutory rules for warrantless searches, vehicle stops, digital device searches (Riley v. California), Miranda invocation, and Sixth Amendment right to counsel.'
  },
  {
    id: 'crim-self-defense',
    domain: 'criminal',
    title: 'Castle Doctrine, Stand Your Ground & Use-of-Force Law',
    mode: 'statute_lookup',
    prompt: 'Examine statutory justifiable force, Castle Doctrine, Stand Your Ground immunity hearings, duty to retreat rules, and civil immunity shields in the selected state jurisdiction.'
  },
  {
    id: 'crim-title18-rico',
    domain: 'criminal',
    title: 'Federal Title 18 Offenses, Wire Fraud & Forfeiture Defense',
    mode: 'legal_counsel',
    prompt: 'Analyze federal criminal exposure and statutory defenses under Title 18 U.S.C. including Wire Fraud (§ 1343), Conspiracy (§ 371), CFAA (§ 1030), and Civil Asset Forfeiture Reform Act protections (18 U.S.C. § 983).'
  },
  // Civil
  {
    id: 'civ-sol-matrix',
    domain: 'civil',
    title: 'Civil Statutes of Limitations & Tolling Rules',
    mode: 'statute_lookup',
    prompt: 'Provide the exact statutory filing deadlines for written contracts, oral contracts, fraud, personal injury, property damage, and breach of fiduciary duty, plus discovery-rule tolling exceptions.'
  },
  {
    id: 'civ-injunction-frcp',
    domain: 'civil',
    title: 'TROs, Preliminary Injunctions & Tort Liability Elements',
    mode: 'legal_counsel',
    prompt: 'Analyze the four-factor test and bond requirements for Temporary Restraining Orders and Preliminary Injunctions (FRCP Rule 65 / state equivalents) alongside comparative vs. contributory negligence regimes.'
  },
  {
    id: 'civ-property-trusts',
    domain: 'civil',
    title: 'Real Property Quiet Title, Liens & Irrevocable Trusts',
    mode: 'legal_counsel',
    prompt: 'Examine quiet title actions, mechanic and judgment lien priority, adverse possession statutory periods, and irrevocable trust spendthrift/asset-protection provisions.'
  },
  {
    id: 'civ-1983-bureaucracy',
    domain: 'civil',
    title: '42 U.S.C. § 1983 Civil Rights & Anti-Retaliation Shield',
    mode: 'defense_strategy',
    defenseStatementType: 'educator_bureaucracy_shield',
    prompt: 'Establish civil accountability and injunctive/damages deterrence under 42 U.S.C. § 1983, state whistleblower acts, and Procedural Due Process (14th Amendment) when government officials or school district bureaucrats act arbitrarily or retaliate against House Grey or Lady Grey.'
  }
];

// Internal Law Library: Verified U.S. Legal Precedents across Criminal, Constitutional, Business, Professional & Civil Law
export const US_LAW_LIBRARY_PRECEDENTS: LawLibraryPrecedent[] = [
  {
    id: 'prec-katz',
    caseName: 'Katz v. United States',
    citation: '389 U.S. 347',
    court: 'U.S. Supreme Court',
    year: 1967,
    domain: 'criminal',
    doctrine: 'Fourth Amendment Reasonable Expectation of Privacy',
    holdingSummary: 'The Fourth Amendment protects people, not places; warrantless government intrusion where a person exhibits a reasonable expectation of privacy is per se unreasonable.',
    defensiveApplication: 'Cite to challenge warrantless electronic surveillance, private premises monitoring, or non-consensual inspection of protected Grey House spaces.',
    relatedStatutes: ['U.S. Const. amend. IV', '18 U.S.C. § 2510 et seq.']
  },
  {
    id: 'prec-riley',
    caseName: 'Riley v. California',
    citation: '573 U.S. 373',
    court: 'U.S. Supreme Court',
    year: 2014,
    domain: 'criminal',
    doctrine: 'Digital Device Search Warrant Requirement',
    holdingSummary: 'Officers generally must secure a judicial warrant before searching digital information stored on a cell phone or digital device, even incident to a lawful arrest.',
    defensiveApplication: 'Invoke in defense notices and suppression motions barring warrantless forensic inspection of phones, laptops, or encrypted Grey House hardware.',
    relatedStatutes: ['U.S. Const. amend. IV', 'Fed. R. Crim. P. 41']
  },
  {
    id: 'prec-carpenter',
    caseName: 'Carpenter v. United States',
    citation: '585 U.S. 296',
    court: 'U.S. Supreme Court',
    year: 2018,
    domain: 'criminal',
    doctrine: 'Digital Location & Third-Party Record Warrant Rule',
    holdingSummary: 'Acquisition of historical cell-site location records constitutes a Fourth Amendment search requiring a warrant supported by probable cause.',
    defensiveApplication: 'Assert against sweeping administrative subpoenas or warrantless demands seeking third-party telemetry, cloud logs, or movement histories.',
    relatedStatutes: ['U.S. Const. amend. IV', '18 U.S.C. § 2703']
  },
  {
    id: 'prec-miranda-edwards',
    caseName: 'Miranda v. Arizona / Edwards v. Arizona',
    citation: '384 U.S. 436 / 451 U.S. 477',
    court: 'U.S. Supreme Court',
    year: 1981,
    domain: 'criminal',
    doctrine: 'Fifth Amendment Right to Silence & Cessation of Questioning',
    holdingSummary: 'Once a subject invokes the Fifth Amendment right to counsel during custodial interrogation, all questioning must cease immediately unless counsel is present.',
    defensiveApplication: 'Anchor criminal defense statements with unequivocal written invocation of silence and legal counsel, invalidating subsequent uncounseled questioning.',
    relatedStatutes: ['U.S. Const. amend. V', 'U.S. Const. amend. VI']
  },
  {
    id: 'prec-terry',
    caseName: 'Terry v. Ohio',
    citation: '392 U.S. 1',
    court: 'U.S. Supreme Court',
    year: 1968,
    domain: 'criminal',
    doctrine: 'Reasonable Articulable Suspicion Limit on Detentions',
    holdingSummary: 'Brief investigative detentions require specific, articulable facts creating reasonable suspicion of criminal activity—never mere hunches.',
    defensiveApplication: 'Challenge unlawful stops, prolonged detentions, or fishing-expedition seizures lacking individualized factual basis.',
    relatedStatutes: ['U.S. Const. amend. IV', '42 U.S.C. § 1983']
  },
  {
    id: 'prec-brady',
    caseName: 'Brady v. Maryland',
    citation: '373 U.S. 83',
    court: 'U.S. Supreme Court',
    year: 1963,
    domain: 'criminal',
    doctrine: 'Mandatory Exculpatory Evidence Disclosure',
    holdingSummary: 'Suppression by the prosecution of evidence favorable to an accused violates Fourteenth and Fifth Amendment Due Process where the evidence is material to guilt or punishment.',
    defensiveApplication: 'Include formal Brady/Giglio preservation demands in any defense statement or response to investigative inquiries.',
    relatedStatutes: ['U.S. Const. amend. V', 'Fed. R. Crim. P. 16']
  },
  {
    id: 'prec-timbs',
    caseName: 'Timbs v. Indiana',
    citation: '586 U.S. 146',
    court: 'U.S. Supreme Court',
    year: 2019,
    domain: 'criminal',
    doctrine: 'Eighth Amendment Excessive Fines Limit on Asset Forfeiture',
    holdingSummary: 'The Excessive Fines Clause is incorporated against the States and restricts civil and criminal in rem asset forfeitures that are grossly disproportionate.',
    defensiveApplication: 'Cite to defeat overbroad state or federal asset seizure and forfeiture demands alongside CAFRA procedural protections.',
    relatedStatutes: ['U.S. Const. amend. VIII', '18 U.S.C. § 983']
  },
  {
    id: 'prec-bruen',
    caseName: 'District of Columbia v. Heller / NYSRPA v. Bruen',
    citation: '554 U.S. 570 / 597 U.S. 1',
    court: 'U.S. Supreme Court',
    year: 2022,
    domain: 'constitutional',
    doctrine: 'Second Amendment Self-Defense & Historical Tradition Standard',
    holdingSummary: 'The Second Amendment protects the individual right to keep and bear arms for self-defense; government restrictions must align with the Nation’s historical tradition.',
    defensiveApplication: 'Ground statutory self-defense, home-defense, and lawful possession rights against unconstitutional state or municipal overreach.',
    relatedStatutes: ['U.S. Const. amend. II']
  },
  {
    id: 'prec-aronson',
    caseName: 'Aronson v. Lewis',
    citation: '473 A.2d 805',
    court: 'Delaware Supreme Court',
    year: 1984,
    domain: 'business',
    doctrine: 'Business Judgment Rule Presumption',
    holdingSummary: 'Corporate directors and officers enjoy a strong presumption that in making business decisions they acted on an informed basis, in good faith, and in the honest belief the action was in the company’s best interests.',
    defensiveApplication: 'Shield Grey House executives and managing members from hindsight fiduciary claims by documenting informed deliberation.',
    relatedStatutes: ['Del. Code tit. 8, § 141', 'Del. Code tit. 8, § 102(b)(7)']
  },
  {
    id: 'prec-caremark',
    caseName: 'In re Caremark Int’l Inc. Derivative Litig.',
    citation: '698 A.2d 959',
    court: 'Delaware Court of Chancery',
    year: 1996,
    domain: 'business',
    doctrine: 'Board Oversight & Good-Faith Compliance Shield',
    holdingSummary: 'Oversight liability requires sustained or systematic failure to assure reasonable information and reporting systems—an intentionally high threshold protecting fiduciaries.',
    defensiveApplication: 'Refute derivative mismanagement claims by demonstrating documented Grey House compliance protocols and good-faith monitoring.',
    relatedStatutes: ['Del. Code tit. 8, § 141(a)', 'Del. Code tit. 6, § 18-1101']
  },
  {
    id: 'prec-ebay',
    caseName: 'eBay Inc. v. MercExchange, L.L.C.',
    citation: '547 U.S. 388',
    court: 'U.S. Supreme Court',
    year: 2006,
    domain: 'business',
    doctrine: 'Strict Four-Factor Equitable Injunction Bar',
    holdingSummary: 'A plaintiff seeking permanent injunctive relief must satisfy a traditional four-factor equitable test, including irreparable harm and inadequacy of monetary damages.',
    defensiveApplication: 'Defeat emergency or permanent injunctions aimed at halting Grey House commercial operations where monetary remedies suffice.',
    relatedStatutes: ['FRCP Rule 65', '35 U.S.C. § 283']
  },
  {
    id: 'prec-concepcion',
    caseName: 'AT&T Mobility LLC v. Concepcion',
    citation: '563 U.S. 333',
    court: 'U.S. Supreme Court',
    year: 2011,
    domain: 'business',
    doctrine: 'Federal Arbitration Act Preemption & Enforcement',
    holdingSummary: 'Section 2 of the Federal Arbitration Act places arbitration agreements on equal footing with contracts and preempts state rules disfavoring bilateral arbitration.',
    defensiveApplication: 'Invoke in commercial responses to compel private arbitration and defeat state-court or class-action venue maneuvers.',
    relatedStatutes: ['9 U.S.C. § 2', '9 U.S.C. § 3']
  },
  {
    id: 'prec-loper-bright',
    caseName: 'Loper Bright Enterprises v. Raimondo',
    citation: '603 U.S. 369',
    court: 'U.S. Supreme Court',
    year: 2024,
    domain: 'professional',
    doctrine: 'Independent Judicial Statutory Review (End of Chevron Deference)',
    holdingSummary: 'Overruling Chevron, courts must exercise independent judgment under the APA in deciding whether an agency acted within its statutory authority, without deferring to agency ambiguity claims.',
    defensiveApplication: 'Challenge aggressive federal regulatory interpretations, licensing sanctions, or agency enforcement directives lacking clear statutory text.',
    relatedStatutes: ['5 U.S.C. § 706']
  },
  {
    id: 'prec-west-virginia',
    caseName: 'West Virginia v. EPA',
    citation: '597 U.S. 697',
    court: 'U.S. Supreme Court',
    year: 2022,
    domain: 'professional',
    doctrine: 'Major Questions Doctrine',
    holdingSummary: 'Agencies asserting sweeping regulatory authority of major economic or political significance must point to clear congressional authorization.',
    defensiveApplication: 'Block ultra vires agency rules or compliance penalties that exceed explicit statutory delegation.',
    relatedStatutes: ['5 U.S.C. § 706(2)(C)', 'U.S. Const. art. I, § 1']
  },
  {
    id: 'prec-mathews',
    caseName: 'Mathews v. Eldridge',
    citation: '424 U.S. 319',
    court: 'U.S. Supreme Court',
    year: 1976,
    domain: 'professional',
    doctrine: 'Procedural Due Process Balancing Test',
    holdingSummary: 'Due process before depriving a protected liberty, property, or professional license interest balances private stakes, risk of erroneous deprivation, and government burden.',
    defensiveApplication: 'Demand full pre-deprivation notice, evidentiary disclosure, and hearing rights before any state licensing board or agency sanction.',
    relatedStatutes: ['U.S. Const. amend. XIV', '5 U.S.C. § 554']
  },
  {
    id: 'prec-campbell',
    caseName: 'Campbell v. Acuff-Rose Music, Inc.',
    citation: '510 U.S. 569',
    court: 'U.S. Supreme Court',
    year: 1994,
    domain: 'professional',
    doctrine: 'Transformative Fair Use Copyright Defense',
    holdingSummary: 'Commercial character does not disqualify fair use where the new work adds transformative meaning, critique, or commentary under the four statutory factors.',
    defensiveApplication: 'Rebut overreaching DMCA takedowns or copyright threats directed at Grey House commentary, audit, or research outputs.',
    relatedStatutes: ['17 U.S.C. § 107', '17 U.S.C. § 512(f)']
  },
  {
    id: 'prec-iqbal-twombly',
    caseName: 'Bell Atlantic Corp. v. Twombly / Ashcroft v. Iqbal',
    citation: '550 U.S. 544 / 556 U.S. 662',
    court: 'U.S. Supreme Court',
    year: 2009,
    domain: 'civil',
    doctrine: 'Plausibility Pleading Threshold (Rule 12(b)(6) Dismissal)',
    holdingSummary: 'Complaints built on bare legal conclusions or threadbare recitals without plausible factual allegations fail as a matter of law.',
    defensiveApplication: 'Attack vague, speculative civil claims or demand letters early by demonstrating failure to state non-conclusory factual elements.',
    relatedStatutes: ['FRCP Rule 8(a)', 'FRCP Rule 12(b)(6)']
  },
  {
    id: 'prec-bms-shoe',
    caseName: 'International Shoe Co. v. Washington / Bristol-Myers Squibb',
    citation: '326 U.S. 310 / 582 U.S. 255',
    court: 'U.S. Supreme Court',
    year: 2017,
    domain: 'civil',
    doctrine: 'Minimum Contacts & Personal Jurisdiction Defense',
    holdingSummary: 'Out-of-state courts lack specific personal jurisdiction unless the defendant’s suit-related conduct creates a substantial connection with the forum state.',
    defensiveApplication: 'Preserve and assert Rule 12(b)(2) jurisdictional objections to block forum-shopping lawsuits filed in hostile remote states.',
    relatedStatutes: ['U.S. Const. amend. XIV', 'FRCP Rule 12(b)(2)']
  },
  {
    id: 'prec-sullivan-gertz',
    caseName: 'New York Times Co. v. Sullivan / Gertz v. Robert Welch',
    citation: '376 U.S. 254 / 418 U.S. 323',
    court: 'U.S. Supreme Court',
    year: 1974,
    domain: 'civil',
    doctrine: 'First Amendment Defamation Standards & Fault Thresholds',
    holdingSummary: 'Speech on matters of public concern is shielded against strict-liability defamation; public figures must prove actual malice, and truth/pure opinion are protected.',
    defensiveApplication: 'Deploy both to defend House commentary against SLAPP/defamation threats and to establish actual malice when pursuing willful falsehoods against the House.',
    relatedStatutes: ['U.S. Const. amend. I', 'State Anti-SLAPP Statutes']
  },
  {
    id: 'prec-winter',
    caseName: 'Winter v. Natural Resources Defense Council, Inc.',
    citation: '555 U.S. 7',
    court: 'U.S. Supreme Court',
    year: 2008,
    domain: 'civil',
    doctrine: 'Likelihood of Irreparable Harm Required for Injunctions',
    holdingSummary: 'A preliminary injunction is an extraordinary remedy requiring a clear showing that irreparable injury is likely—not merely possible—in the absence of relief.',
    defensiveApplication: 'Oppose emergency TROs and asset-freeze motions that rely on speculative harm rather than concrete, imminent irreparable injury.',
    relatedStatutes: ['FRCP Rule 65']
  },
  {
    id: 'prec-garrity',
    caseName: 'Garrity v. New Jersey',
    citation: '385 U.S. 493',
    court: 'U.S. Supreme Court',
    year: 1967,
    domain: 'criminal',
    doctrine: 'Public Employee Anti-Coercion & Self-Incrimination Shield',
    holdingSummary: 'Statements obtained from public employees—including public school teachers—under threat of termination or severe job penalty are coerced and inadmissible in any subsequent criminal prosecution.',
    defensiveApplication: 'Invoked immediately whenever school HR, state investigators, or district bureaucracy demand compulsory written/verbal statements from Lady Grey or any House member.',
    relatedStatutes: ['U.S. Const. amend. V', 'U.S. Const. amend. XIV', '42 U.S.C. § 1983']
  },
  {
    id: 'prec-loudermill',
    caseName: 'Cleveland Board of Education v. Loudermill',
    citation: '470 U.S. 532',
    court: 'U.S. Supreme Court',
    year: 1985,
    domain: 'professional',
    doctrine: 'Public Teacher Pre-Termination Due Process Right',
    holdingSummary: 'Tenured or contract public school employees hold a constitutionally protected property interest in continued employment and cannot be terminated without prior written notice of charges, explanation of employer evidence, and an opportunity to present their side.',
    defensiveApplication: 'Primary shield protecting Lady Grey against summary dismissal, adverse administrative placement, or arbitrary school board bureaucracy action.',
    relatedStatutes: ['U.S. Const. amend. XIV', '42 U.S.C. § 1983', '20 U.S.C. §§ 7941–7948']
  },
  {
    id: 'prec-pickering',
    caseName: 'Pickering v. Board of Education',
    citation: '391 U.S. 563',
    court: 'U.S. Supreme Court',
    year: 1968,
    domain: 'professional',
    doctrine: 'Educator First Amendment & Anti-Retaliation Protection',
    holdingSummary: 'Public school teachers retain First Amendment protection to speak as citizens on matters of public or educational concern free from retaliatory dismissal or bureaucratic punishment.',
    defensiveApplication: 'Deploy to block school board or superintendent retaliation when Lady Grey raises safety, policy, legal compliance, or educational concerns.',
    relatedStatutes: ['U.S. Const. amend. I', '42 U.S.C. § 1983']
  },
  {
    id: 'prec-kennedy-bremerton',
    caseName: 'Kennedy v. Bremerton School District',
    citation: '597 U.S. 507',
    court: 'U.S. Supreme Court',
    year: 2022,
    domain: 'constitutional',
    doctrine: 'Teacher Personal Conscience & Non-Coercive Expression Shield',
    holdingSummary: 'School districts violate the First Amendment by punishing teachers for non-coercive private expression or personal conscience outside formal instructional delivery.',
    defensiveApplication: 'Protects Lady Grey against ideological coercion or overbroad district policy enforcement targeting private beliefs or lawful outside-instruction conduct.',
    relatedStatutes: ['U.S. Const. amend. I', '42 U.S.C. § 2000e (Title VII)']
  },
  {
    id: 'prec-weingarten',
    caseName: 'NLRB v. J. Weingarten, Inc.',
    citation: '420 U.S. 251',
    court: 'U.S. Supreme Court',
    year: 1975,
    domain: 'professional',
    doctrine: 'Right to Union / Legal Representative in Investigatory Meetings',
    holdingSummary: 'An employee has the statutory right to refuse uncounseled participation and insist upon union or representative presence during any investigatory interview reasonably feared to lead to discipline.',
    defensiveApplication: 'Stop ambush HR, principal, or district bureaucracy meetings immediately until Lady Grey has an educator-association representative or counsel present.',
    relatedStatutes: ['29 U.S.C. § 157', 'State Public Employee Collective Bargaining Acts']
  },
  {
    id: 'prec-gideon-crawford',
    caseName: 'Gideon v. Wainwright / Crawford v. Washington',
    citation: '372 U.S. 335 / 541 U.S. 36',
    court: 'U.S. Supreme Court',
    year: 2004,
    domain: 'criminal',
    doctrine: 'Sixth Amendment Right to Counsel & Bar on Unconfronted Hearsay',
    holdingSummary: 'Criminal defendants hold an inviolate Sixth Amendment right to counsel and cannot be convicted on testimonial hearsay absent unavailability and prior opportunity for cross-examination.',
    defensiveApplication: 'Demand full confrontation of accusers and dismantle anonymous, hearsay-driven allegations in both criminal defense and quasi-criminal administrative hearings.',
    relatedStatutes: ['U.S. Const. amend. VI', 'Fed. R. Evid. 801–804']
  }
];

export function matchPrecedentsForScenario(
  domain: LegalPracticeArea,
  queryText: string,
  limit: number = 4
): LawLibraryPrecedent[] {
  const lowerQuery = queryText.toLowerCase();
  const tokens = lowerQuery
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);

  const isEducatorOrBureaucracy =
    /teacher|lady grey|educator|school|district|superintendent|principal|board|tenure|credential|licens|bureaucrac|coverdell|ferpa|union|hr\b|classroom/.test(
      lowerQuery
    );

  const scored = US_LAW_LIBRARY_PRECEDENTS.map((p) => {
    let score = 0;
    if (domain !== 'all' && p.domain === domain) score += 4;
    if (
      isEducatorOrBureaucracy &&
      ['prec-loudermill', 'prec-garrity', 'prec-pickering', 'prec-weingarten', 'prec-kennedy-bremerton', 'prec-mathews', 'prec-loper-bright'].includes(p.id)
    ) {
      score += 6;
    }
    const hay = `${p.caseName} ${p.doctrine} ${p.holdingSummary} ${p.defensiveApplication} ${p.relatedStatutes.join(' ')}`.toLowerCase();
    for (const tok of tokens) {
      if (hay.includes(tok)) score += 2;
    }
    return { p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((item) => item.p);
}

