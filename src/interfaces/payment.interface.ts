// Shape shared by Flutterwave and the partner gateway; failed calls come back as { status: "error", success: false }
export interface IProviderResponse {
  status: string;
  success?: boolean;
  data?: any;
  message?: string;
}

export interface IFlutterwavePaymentPayload {
  tx_ref: string;
  amount: string;
  currency: string;
  redirect_url: string;
  customer: {
    email: string;
    name: string;
    phone_number: string;
  };
  customizations: {
    title: string;
  };
}

export interface IPartnerDynamicAccountPayload {
  firstName: string;
  lastName: string;
  amount: string;
}

// Query string Flutterwave appends to the redirect URL
export interface IPaymentRedirectQuery {
  tx_ref?: string;
  status?: string;
  transaction_id?: string;
}

export type PaymentVerificationResult =
  | { alreadyVerified: true; transaction: unknown }
  | { alreadyVerified: false; redirectUrl: string };
