export interface CreditRequest {
  id: string;
  status: string;
  country: string;
  amount: number;
  currency: string;
  created_at: string;
  customerName: string;
}

export interface StatusEvent {
  requestId: string;
  country: string;
  new: string;
  old: string;
}
