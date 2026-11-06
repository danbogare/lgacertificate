import { IPartnerConfig } from "../config/env";
import { IPartnerDynamicAccountPayload, IProviderResponse } from "../interfaces/payment.interface";
import { RequestProvider } from "../models/requestDump.model";
import { IHttpClient } from "./http.service";

export interface IPartnerPaymentService {
  createDynamicAccount(payload: IPartnerDynamicAccountPayload): Promise<IProviderResponse>;
}

// Bank transfer payments: the partner issues a one-off account and notifies us through the webhook
export class PartnerPaymentService implements IPartnerPaymentService {
  constructor(
    private readonly httpClient: IHttpClient,
    private readonly config: IPartnerConfig
  ) {}

  public async createDynamicAccount(payload: IPartnerDynamicAccountPayload): Promise<IProviderResponse> {
    return await this.httpClient.request(
      "POST",
      `${this.config.baseUrl}partners/dynamic/account`,
      payload,
      { "x-api-key": this.config.apiKey, "merchant-id": this.config.merchantId },
      { isFailedResponse: (response) => !response?.success, provider: RequestProvider.PARTNER }
    );
  }
}
