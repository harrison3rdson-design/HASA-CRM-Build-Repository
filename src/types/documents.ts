export interface CompanyBranding {
  legalName: string;
  displayName: string;
  logoHorizontalUrl?: string;
  logoSquareUrl?: string;
  addressLines?: string[];
  phone?: string;
  email?: string;
  website?: string;
  proposalFooter?: string;
  invoiceFooter?: string;
}

export interface ProposalDocumentModel {
  proposalNumber: string;
  revisionNumber: number;
  proposalDate: string;
  clientCompany: string;
  clientContact?: string;
  projectName: string;
  projectLocation?: string;
  sections: Array<{ heading: string; content: string }>;
  feeItems: Array<{ description: string; amount: number }>;
  expenseEstimates: Array<{
    category: string;
    description?: string;
    estimatedAmount: number;
  }>;
  professionalFee: number;
  estimatedExpenses: number;
  estimatedTotal: number;
  paymentTerms: string;
  validityDays: number;
  proposalTerms?: string;
  branding: CompanyBranding;
}

export interface InvoiceDocumentModel {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  terms: string;
  clientCompany: string;
  clientContact?: string;
  projectNumber: string;
  projectName: string;
  items: Array<{
    description: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
  subtotal: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  includeExpenseDetail: boolean;
  includeReceiptAppendix: boolean;
  branding: CompanyBranding;
}
