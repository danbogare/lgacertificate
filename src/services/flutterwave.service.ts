import { IFlutterwaveConfig } from "../config/env";
import { IFlutterwavePaymentPayload, IProviderResponse } from "../interfaces/payment.interface";
import { IHttpClient } from "./http.service";

export interface IFlutterwaveService {
  initializePayment(payload: IFlutterwavePaymentPayload): Promise<IProviderResponse>;
  verifyTransaction(transactionId: number): Promise<IProviderResponse>;
}

const isFlutterwaveFailure = (response: IProviderResponse) => response?.status !== "success";

export class FlutterwaveService implements IFlutterwaveService {
  constructor(
    private readonly httpClient: IHttpClient,
    private readonly config: IFlutterwaveConfig
  ) {}

  public async initializePayment(payload: IFlutterwavePaymentPayload): Promise<IProviderResponse> {
    return await this.httpClient.request("POST", `${this.config.uri}payments`, payload, this.headers(), {
      isFailedResponse: isFlutterwaveFailure,
    });
  }

  public async verifyTransaction(transactionId: number): Promise<IProviderResponse> {
    return await this.httpClient.request(
      "GET",
      `${this.config.uri}transactions/${transactionId}/verify`,
      { null: null },
      this.headers(),
      { isFailedResponse: isFlutterwaveFailure }
    );
  }

  private headers() {
    return { Authorization: `Bearer ${this.config.secret}` };
  }
}
