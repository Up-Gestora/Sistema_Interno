export interface AsaasConfig {
  apiKey: string;
  ambiente: 'sandbox' | 'production';
}

export interface AsaasPagamento {
  id: string;
  customer: string;
  billingType: string;
  value: number;
  netValue: number;
  originalValue: number;
  interestValue: number;
  description: string;
  status: string;
  dueDate: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  installmentNumber?: number;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  transactionReceiptUrl?: string;
  invoiceNumber?: string;
  externalReference?: string;
  deleted: boolean;
  anticipated: boolean;
  anticipable: boolean;
  refunds?: any;
  dateCreated: string;
  originalDueDate: string;
}

export interface AsaasCobranca {
  id: string;
  customer: string;
  billingType: string;
  value: number;
  netValue: number;
  originalValue: number;
  interestValue: number;
  description: string;
  status: string;
  dueDate: string;
  originalDueDate: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  installmentNumber?: number;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  transactionReceiptUrl?: string;
  invoiceNumber?: string;
  externalReference?: string;
  deleted: boolean;
  anticipated: boolean;
  anticipable: boolean;
  dateCreated: string;
}

export interface AsaasCliente {
  id: string;
  dateCreated: string;
  name: string;
  email: string;
  phone: string;
  mobilePhone?: string;
  cpfCnpj: string;
  postalCode: string;
  address: string;
  addressNumber: string;
  complement?: string;
  province: string;
  city: string;
  state: string;
  country: string;
  externalReference?: string;
  notificationDisabled: boolean;
  additionalEmails?: string;
  municipalInscription?: string;
  stateInscription?: string;
  canDelete: boolean;
  canNotBeDeletedReason?: string;
  personType: string;
  company?: string;
}

export interface AsaasRespostaPagamentos {
  object: string;
  hasMore: boolean;
  totalCount: number;
  limit: number;
  offset: number;
  data: AsaasPagamento[];
}

export interface AsaasRespostaCobrancas {
  object: string;
  hasMore: boolean;
  totalCount: number;
  limit: number;
  offset: number;
  data: AsaasCobranca[];
}

export interface AsaasResumoFinanceiro {
  balance: number;
  received: number;
  confirmed: number;
  pending: number;
  overdue: number;
  refunded: number;
}

export interface AsaasSubscription {
  id: string;
  customer: string;
  billingType: string;
  value: number;
  nextDueDate: string;
  cycle: string;
  description: string;
  status: string;
  dateCreated: string;
  endDate?: string;
  externalReference?: string;
}

export interface AsaasRespostaSubscriptions {
  object: string;
  hasMore: boolean;
  totalCount: number;
  limit: number;
  offset: number;
  data: AsaasSubscription[];
}


