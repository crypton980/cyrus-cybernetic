export type Audience = "military" | "official" | "technical" | "executive" | "legal";

export type DocType =
  | "sitrep"
  | "intelsum"
  | "military_report"
  | "ops_plan"
  | "technical_report"
  | "legal_admin"
  | "policy_paper"
  | "research_report"
  | "application_evaluation"
  | "executive_summary"
  | "correspondence"
  // Legal drafting types
  | "summons"
  | "legal_report"
  | "nda"
  | "memorandum_of_agreement"
  | "case_report"
  | "affidavit"
  | "court_order"
  | "legal_notice"
  | "settlement_agreement"
  | "power_of_attorney";

export interface TemplateSection {
  id: string;
  title: string;
  required: boolean;
}

export const templates: Record<DocType, TemplateSection[]> = {
  sitrep: [
    { id: "purpose", title: "Purpose", required: true },
    { id: "situation", title: "Situation / Background", required: true },
    { id: "friendly", title: "Friendly Forces", required: true },
    { id: "enemy", title: "Enemy / Threat", required: true },
    { id: "civil", title: "Civil / Neutral", required: false },
    { id: "significant", title: "Significant Activities", required: true },
    { id: "analysis", title: "Analysis", required: true },
    { id: "assessment", title: "Assessment", required: true },
    { id: "recommendations", title: "Recommendations", required: true },
    { id: "risk", title: "Risks / Mitigations", required: true },
    { id: "annexes", title: "Annexes", required: false },
  ],
  intelsum: [
    { id: "purpose", title: "Purpose", required: true },
    { id: "summary", title: "Intelligence Summary", required: true },
    { id: "indicators", title: "Indicators / Warnings", required: true },
    { id: "assessments", title: "Assessments", required: true },
    { id: "confidence", title: "Confidence & Sources", required: true },
    { id: "recommendations", title: "Recommendations", required: true },
  ],
  military_report: [
    { id: "purpose", title: "Purpose", required: true },
    { id: "background", title: "Background", required: true },
    { id: "situation", title: "Situation", required: true },
    { id: "analysis", title: "Analysis", required: true },
    { id: "findings", title: "Findings", required: true },
    { id: "conclusions", title: "Conclusions", required: true },
    { id: "recommendations", title: "Recommendations", required: true },
    { id: "annexes", title: "Annexes", required: false },
  ],
  ops_plan: [
    { id: "purpose", title: "Purpose", required: true },
    { id: "mission", title: "Mission", required: true },
    { id: "concept", title: "Concept of Operations", required: true },
    { id: "tasks", title: "Tasks", required: true },
    { id: "coordination", title: "Coordinating Instructions", required: true },
    { id: "sustainment", title: "Sustainment", required: true },
    { id: "c2", title: "Command & Control", required: true },
    { id: "risk", title: "Risks / Mitigations", required: true },
    { id: "appendices", title: "Appendices", required: false },
  ],
  technical_report: [
    { id: "purpose", title: "Purpose", required: true },
    { id: "scope", title: "Scope", required: true },
    { id: "background", title: "Background", required: true },
    { id: "methodology", title: "Methodology", required: true },
    { id: "results", title: "Data / Results", required: true },
    { id: "analysis", title: "Analysis", required: true },
    { id: "findings", title: "Findings", required: true },
    { id: "limitations", title: "Limitations", required: true },
    { id: "recommendations", title: "Recommendations", required: true },
    { id: "appendices", title: "Appendices", required: false },
  ],
  legal_admin: [
    { id: "title", title: "Title / Heading", required: true },
    { id: "purpose", title: "Purpose", required: true },
    { id: "authority", title: "Authority / References", required: true },
    { id: "scope", title: "Scope / Applicability", required: true },
    { id: "provisions", title: "Policy / Provisions", required: true },
    { id: "responsibilities", title: "Responsibilities", required: true },
    { id: "compliance", title: "Compliance", required: true },
    { id: "effective", title: "Effective Date", required: true },
    { id: "appendices", title: "Appendices", required: false },
  ],
  policy_paper: [
    { id: "purpose", title: "Purpose", required: true },
    { id: "background", title: "Background", required: true },
    { id: "analysis", title: "Analysis", required: true },
    { id: "options", title: "Options", required: true },
    { id: "recommendation", title: "Recommendation", required: true },
    { id: "impacts", title: "Impacts / Risks", required: true },
    { id: "implementation", title: "Implementation", required: true },
  ],
  research_report: [
    { id: "purpose", title: "Purpose", required: true },
    { id: "abstract", title: "Abstract", required: true },
    { id: "background", title: "Background / Literature", required: true },
    { id: "methods", title: "Methods", required: true },
    { id: "results", title: "Results", required: true },
    { id: "discussion", title: "Discussion", required: true },
    { id: "conclusions", title: "Conclusions", required: true },
    { id: "recommendations", title: "Recommendations", required: true },
    { id: "appendices", title: "Appendices", required: false },
  ],
  application_evaluation: [
    { id: "purpose", title: "Purpose", required: true },
    { id: "subject", title: "Subject / Applicant", required: true },
    { id: "criteria", title: "Criteria", required: true },
    { id: "evidence", title: "Evidence", required: true },
    { id: "evaluation", title: "Evaluation", required: true },
    { id: "findings", title: "Findings", required: true },
    { id: "decision", title: "Decision / Recommendation", required: true },
    { id: "followup", title: "Follow-up Actions", required: true },
  ],
  executive_summary: [
    { id: "purpose", title: "Purpose", required: true },
    { id: "key_points", title: "Key Points", required: true },
    { id: "findings", title: "Findings", required: true },
    { id: "impacts", title: "Impacts", required: true },
    { id: "recommendation", title: "Recommendation", required: true },
    { id: "next_steps", title: "Next Steps", required: true },
  ],
  correspondence: [
    { id: "heading", title: "Heading / Reference", required: true },
    { id: "purpose", title: "Purpose", required: true },
    { id: "body", title: "Body", required: true },
    { id: "action", title: "Requested Action", required: true },
    { id: "closing", title: "Closing / Signature", required: true },
  ],

  // ─── Legal drafting templates ──────────────────────────────────────────────

  summons: [
    { id: "court_header", title: "Court / Tribunal Header", required: true },
    { id: "case_number", title: "Case Number", required: true },
    { id: "parties", title: "Parties (Plaintiff / Defendant)", required: true },
    { id: "command", title: "Command to Appear", required: true },
    { id: "cause_of_action", title: "Cause of Action", required: true },
    { id: "date_time_venue", title: "Date, Time and Venue of Hearing", required: true },
    { id: "relief_sought", title: "Relief Sought", required: true },
    { id: "consequences", title: "Consequences of Non-Appearance", required: true },
    { id: "issued_by", title: "Issued By / Registrar Signature", required: true },
    { id: "service_instructions", title: "Service Instructions", required: false },
  ],

  legal_report: [
    { id: "header", title: "Report Header / Reference", required: true },
    { id: "matter", title: "Matter / Case Reference", required: true },
    { id: "parties", title: "Parties Concerned", required: true },
    { id: "instructions", title: "Instructions Received", required: true },
    { id: "background", title: "Background and Facts", required: true },
    { id: "legal_issues", title: "Legal Issues Identified", required: true },
    { id: "applicable_law", title: "Applicable Laws and Provisions", required: true },
    { id: "analysis", title: "Legal Analysis", required: true },
    { id: "findings", title: "Findings", required: true },
    { id: "opinion", title: "Legal Opinion", required: true },
    { id: "recommendations", title: "Recommendations", required: true },
    { id: "signature", title: "Signature / Date", required: true },
  ],

  nda: [
    { id: "header", title: "Agreement Header", required: true },
    { id: "date_parties", title: "Date and Parties", required: true },
    { id: "recitals", title: "Recitals / Background", required: true },
    { id: "definitions", title: "Definitions", required: true },
    { id: "confidential_info", title: "Definition of Confidential Information", required: true },
    { id: "obligations", title: "Obligations of Receiving Party", required: true },
    { id: "exclusions", title: "Exclusions from Confidentiality", required: true },
    { id: "permitted_disclosure", title: "Permitted Disclosure", required: true },
    { id: "duration", title: "Duration / Term", required: true },
    { id: "remedies", title: "Remedies for Breach", required: true },
    { id: "governing_law", title: "Governing Law and Jurisdiction", required: true },
    { id: "entire_agreement", title: "Entire Agreement / Severability", required: false },
    { id: "signature_block", title: "Signature Block", required: true },
  ],

  memorandum_of_agreement: [
    { id: "header", title: "Memorandum of Agreement Header", required: true },
    { id: "date_parties", title: "Date and Parties", required: true },
    { id: "recitals", title: "Recitals / Background", required: true },
    { id: "definitions", title: "Definitions and Interpretation", required: false },
    { id: "purpose", title: "Purpose and Scope of Agreement", required: true },
    { id: "obligations_party_a", title: "Obligations of Party A", required: true },
    { id: "obligations_party_b", title: "Obligations of Party B", required: true },
    { id: "financial_terms", title: "Financial Terms / Consideration", required: false },
    { id: "term_termination", title: "Term and Termination", required: true },
    { id: "dispute_resolution", title: "Dispute Resolution", required: true },
    { id: "governing_law", title: "Governing Law", required: true },
    { id: "amendments", title: "Amendments", required: false },
    { id: "signature_block", title: "Signature Block", required: true },
  ],

  case_report: [
    { id: "case_header", title: "Case Header / Reference Number", required: true },
    { id: "parties", title: "Parties (Complainant / Respondent / Accused)", required: true },
    { id: "investigating_officer", title: "Investigating Officer / Authority", required: true },
    { id: "date_filed", title: "Date Filed / Period Under Review", required: true },
    { id: "nature_of_matter", title: "Nature of the Matter", required: true },
    { id: "background", title: "Background and Facts", required: true },
    { id: "evidence", title: "Evidence and Exhibits", required: true },
    { id: "witnesses", title: "Witnesses and Statements", required: false },
    { id: "legal_provisions", title: "Applicable Legal Provisions", required: true },
    { id: "analysis", title: "Analysis of Facts and Evidence", required: true },
    { id: "findings", title: "Findings", required: true },
    { id: "conclusions", title: "Conclusions", required: true },
    { id: "recommendations", title: "Recommendations / Proposed Action", required: true },
    { id: "signature", title: "Signature and Date", required: true },
  ],

  affidavit: [
    { id: "court_header", title: "Court / Authority Header", required: true },
    { id: "case_reference", title: "Case Reference", required: true },
    { id: "deponent_details", title: "Deponent's Details", required: true },
    { id: "oath_declaration", title: "Oath / Solemn Declaration", required: true },
    { id: "background_facts", title: "Background and Factual Averments", required: true },
    { id: "supporting_facts", title: "Supporting Facts (numbered paragraphs)", required: true },
    { id: "exhibits", title: "Exhibits / Annexures", required: false },
    { id: "legal_submissions", title: "Legal Submissions (if applicable)", required: false },
    { id: "prayer", title: "Prayer / Relief Sought", required: true },
    { id: "verification", title: "Verification / Commissioner of Oaths", required: true },
  ],

  court_order: [
    { id: "court_header", title: "Court / Tribunal Header", required: true },
    { id: "case_details", title: "Case Number and Parties", required: true },
    { id: "before_judge", title: "Before Honourable Judge / Magistrate", required: true },
    { id: "date_of_order", title: "Date of Order", required: true },
    { id: "matter_heard", title: "Matter Heard / Considered", required: true },
    { id: "findings_of_court", title: "Findings of the Court", required: true },
    { id: "orders_made", title: "Orders Made", required: true },
    { id: "costs", title: "Costs", required: false },
    { id: "compliance_deadline", title: "Compliance Deadline / Return Date", required: false },
    { id: "judge_signature", title: "Judge / Registrar Signature and Seal", required: true },
  ],

  legal_notice: [
    { id: "header", title: "Notice Header / Reference", required: true },
    { id: "date_addressee", title: "Date and Addressee Details", required: true },
    { id: "sender_details", title: "Sender / Firm Details", required: true },
    { id: "subject", title: "Subject / Nature of Notice", required: true },
    { id: "background", title: "Background and Relevant Facts", required: true },
    { id: "legal_basis", title: "Legal Basis / Applicable Provisions", required: true },
    { id: "demand_or_notice", title: "Demand / Notice Content", required: true },
    { id: "deadline", title: "Deadline for Compliance / Response", required: true },
    { id: "consequences", title: "Consequences of Non-Compliance", required: true },
    { id: "without_prejudice", title: "Without Prejudice Reservation (if applicable)", required: false },
    { id: "signature", title: "Signature", required: true },
  ],

  settlement_agreement: [
    { id: "header", title: "Settlement Agreement Header", required: true },
    { id: "date_parties", title: "Date and Parties", required: true },
    { id: "recitals", title: "Recitals / Dispute Background", required: true },
    { id: "definitions", title: "Definitions", required: false },
    { id: "settlement_terms", title: "Settlement Terms and Conditions", required: true },
    { id: "payment_terms", title: "Payment / Compensation Terms", required: false },
    { id: "release_of_claims", title: "Release and Discharge of Claims", required: true },
    { id: "confidentiality", title: "Confidentiality of Settlement", required: false },
    { id: "no_admission", title: "No Admission of Liability", required: true },
    { id: "withdrawal_of_proceedings", title: "Withdrawal / Stay of Proceedings", required: true },
    { id: "governing_law", title: "Governing Law and Jurisdiction", required: true },
    { id: "breach_remedies", title: "Remedies on Breach", required: false },
    { id: "signature_block", title: "Signature Block", required: true },
  ],

  power_of_attorney: [
    { id: "header", title: "Power of Attorney Header", required: true },
    { id: "date", title: "Date of Execution", required: true },
    { id: "principal_details", title: "Principal's Full Details", required: true },
    { id: "attorney_details", title: "Attorney's / Agent's Full Details", required: true },
    { id: "appointment", title: "Appointment and Grant of Authority", required: true },
    { id: "scope_of_powers", title: "Scope of Powers Granted", required: true },
    { id: "limitations", title: "Limitations on Authority", required: false },
    { id: "duration", title: "Duration / Revocation", required: true },
    { id: "ratification", title: "Ratification of Prior Acts", required: false },
    { id: "governing_law", title: "Governing Law", required: true },
    { id: "execution", title: "Execution / Witness / Commissioner of Oaths", required: true },
  ],
};

export const defaultDocType: DocType = "executive_summary";

export const toneByAudience: Record<Audience, string> = {
  military: "concise, directive, neutral, mission-focused",
  official: "formal, precise, policy-aligned",
  technical: "exact, analytical, evidence-based",
  executive: "high-level, decisive, outcome-focused",
  legal: "precise, unambiguous, formal legal language, jurisdiction-compliant, citing applicable statutes and case law where relevant",
};

