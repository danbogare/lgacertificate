import axios, { AxiosRequestConfig } from "axios";
import { randomUUID } from "crypto";
import { setTimeout as sleep } from "timers/promises";
import { IProviderResponse } from "../interfaces/payment.interface";
import { IRequestDump, RequestDirection, RequestProvider } from "../models/requestDump.model";
import { IRequestDumpRepository } from "../repositories/requestDump.repository";
import { redactHeaders } from "../utils/request";

const DEFAULT_TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [500, 1000, 2000];

export interface IRequestOptions<T> {
  // Lets a provider's own failure response (sent with a 2xx status) be retried like a failed call
  isFailedResponse?: (data: T) => boolean;
  // When set, every attempt is saved as a request dump for this provider
  provider?: RequestProvider;
  reference?: string;
}

export interface IHttpClient {
  request<T extends IProviderResponse>(
    method: AxiosRequestConfig["method"],
    url: string,
    payload?: object,
    headers?: AxiosRequestConfig["headers"],
    options?: IRequestOptions<T>
  ): Promise<T>;
}

type AttemptOutcome = Pick<IRequestDump, "responseStatus" | "responseBody" | "errorMessage">;

// Retries failed calls up to 3 times with a growing pause. Once retries run out it resolves to the
// provider's last failure response, or { status: "error", success: false } when there was none,
// so callers check the provider status instead of catching. Unreachable providers still throw.
export class HttpClient implements IHttpClient {
  constructor(private readonly requestDumpRepository: IRequestDumpRepository) {}

  public async request<T extends IProviderResponse>(
    method: AxiosRequestConfig["method"],
    url: string,
    payload?: object,
    headers?: AxiosRequestConfig["headers"],
    options: IRequestOptions<T> = {}
  ): Promise<T> {
    const config: AxiosRequestConfig = {
      method,
      url,
      data: payload,
      headers,
      timeout: DEFAULT_TIMEOUT_MS,
      maxRedirects: 5,
    };

    // Shared by all retries of this call so they can be grouped together
    const requestId = randomUUID();
    let failure: T = { status: "error", success: false } as T;
    let lastError: unknown;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) {
        console.warn(`${method} ${url} failed, retry ${attempt} of ${RETRY_DELAYS_MS.length}`);
        await sleep(RETRY_DELAYS_MS[attempt - 1]);
      }

      const startedAt = Date.now();
      try {
        const { data, status } = await axios.request<T>(config);
        this.recordAttempt(config, options, requestId, attempt, startedAt, {
          responseStatus: status,
          responseBody: data,
        });
        if (!options.isFailedResponse?.(data)) return data;
        failure = data;
        lastError = undefined;
      } catch (error) {
        this.recordAttempt(config, options, requestId, attempt, startedAt, this.describeError(error));
        // Client errors such as bad credentials won't succeed on a retry
        if (!this.isRetryable(error)) return failure;
        lastError = error;
      }
    }

    if ((lastError as Error | undefined)?.message === "Network Error") {
      throw new Error("Unable to connect to the server. Please try again later.");
    }
    return failure;
  }

  // Timeouts, connection failures, 5xx, 408 and 429 are worth another try
  private isRetryable(error: unknown): boolean {
    if (!axios.isAxiosError(error) || !error.response) return true;
    const { status } = error.response;
    return status >= 500 || status === 408 || status === 429;
  }

  private describeError(error: unknown): AttemptOutcome {
    if (!axios.isAxiosError(error)) return { errorMessage: (error as Error)?.message };
    return {
      responseStatus: error.response?.status,
      responseBody: error.response?.data,
      errorMessage: error.message,
    };
  }

  // Saved in the background so a database problem never blocks or fails the provider call
  private recordAttempt<T>(
    config: AxiosRequestConfig,
    options: IRequestOptions<T>,
    requestId: string,
    attempt: number,
    startedAt: number,
    outcome: AttemptOutcome
  ): void {
    if (!options.provider) return;

    this.requestDumpRepository
      .create({
        requestId,
        provider: options.provider,
        direction: RequestDirection.OUTBOUND,
        method: config.method,
        url: config.url,
        requestHeaders: redactHeaders(config.headers ?? {}),
        requestBody: config.data,
        attempt,
        durationMs: Date.now() - startedAt,
        reference: options.reference,
        ...outcome,
      })
      .catch((error) => console.error(`Failed to save request dump for ${config.method} ${config.url}:`, error));
  }
}
