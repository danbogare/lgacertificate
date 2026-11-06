import express, { Application, Request, Response } from "express";
import cors from "cors";
import { env } from "./config/env";
import { ErrorMiddleware } from "./middlewares/error.middleware";
import { AuthMiddleware } from "./middlewares/auth.middleware";
import { WebhookMiddleware } from "./middlewares/webhook.middleware";
import { RequestDumpMiddleware } from "./middlewares/request-dump.middleware";
import { rawBodySaver } from "./middlewares/raw-body.middleware";
import { User } from "./models/user.model";
import { Admin } from "./models/admin.model";
import { Application as ApplicationModel } from "./models/application.model";
import { Certificate } from "./models/certificate.model";
import { Counter } from "./models/counter.model";
import { Transaction } from "./models/transaction.model";
import { PartnerTransaction } from "./models/partnerTransaction.model";
import { Signatory } from "./models/signatory.model";
import { AuditLog } from "./models/auditLog.model";
import { RequestDump } from "./models/requestDump.model";
import { UserRepository } from "./repositories/user.repository";
import { AdminRepository } from "./repositories/admin.repository";
import { ApplicationRepository } from "./repositories/application.repository";
import { CertificateRepository } from "./repositories/certificate.repository";
import { CounterRepository } from "./repositories/counter.repository";
import { TransactionRepository } from "./repositories/transaction.repository";
import { PartnerTransactionRepository } from "./repositories/partnerTransaction.repository";
import { SignatoryRepository } from "./repositories/signatory.repository";
import { AuditLogRepository } from "./repositories/auditLog.repository";
import { RequestDumpRepository } from "./repositories/requestDump.repository";
import { CryptoService } from "./services/crypto.service";
import { MailService } from "./services/mail.service";
import { CloudinaryService } from "./services/storage.service";
import { HttpClient } from "./services/http.service";
import { FlutterwaveService } from "./services/flutterwave.service";
import { PartnerPaymentService } from "./services/partner-payment.service";
import { PaymentService } from "./services/payment.service";
import { AuthService } from "./services/auth.service";
import { AdminService } from "./services/admin.service";
import { CertificateService } from "./services/certificate.service";
import { ApplicationService } from "./services/application.service";
import { SignatoryService } from "./services/signatory.service";
import { LocationService } from "./services/location.service";
import { WebhookService } from "./services/webhook.service";
import { AuditService } from "./services/audit.service";
import { AuthController } from "./controllers/auth.controller";
import { AdminController } from "./controllers/admin.controller";
import { ApplicationController } from "./controllers/application.controller";
import { CertificateController } from "./controllers/certificate.controller";
import { SignatoryController } from "./controllers/signatory.controller";
import { LocationController } from "./controllers/location.controller";
import { PartnerController } from "./controllers/partner.controller";
import { AuditController } from "./controllers/audit.controller";
import { AuthRouter } from "./routes/auth.route";
import { AdminRouter } from "./routes/admin.route";
import { ApplicationRouter } from "./routes/application.route";
import { CertificateRouter } from "./routes/certificate.route";
import { SignatoryRouter } from "./routes/signatory.route";
import { LocationRouter } from "./routes/location.route";
import { PartnerRouter } from "./routes/partner.route";

const API_PREFIX = "/api/v1";

class App {
  public readonly instance: Application;
  private readonly errorMiddleware = new ErrorMiddleware();

  constructor() {
    this.instance = express();

    this.initializeMiddlewares();
    this.initializeBaseRoutes();
    this.initializeApiRoutes();
    this.initialize404Handling();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Lets req.ip reflect the real client behind a load balancer, which audit logs record
    this.instance.set("trust proxy", env.trustProxy);
    this.instance.use(cors());
    // The raw body is kept for verifying partner webhook signatures
    this.instance.use(express.json({ verify: rawBodySaver }));
    this.instance.use(express.urlencoded({ extended: true }));
  }

  private initializeBaseRoutes(): void {
    this.instance.get("/", (_req: Request, res: Response) => {
      res.status(200).json({ message: "Welcome to LGA Certificate Server" });
    });
  }

  private initializeApiRoutes(): void {
    // repositories
    const userRepository = new UserRepository(User);
    const adminRepository = new AdminRepository(Admin);
    const applicationRepository = new ApplicationRepository(ApplicationModel);
    const certificateRepository = new CertificateRepository(Certificate);
    const counterRepository = new CounterRepository(Counter);
    const transactionRepository = new TransactionRepository(Transaction);
    const partnerTransactionRepository = new PartnerTransactionRepository(PartnerTransaction);
    const signatoryRepository = new SignatoryRepository(Signatory);
    const auditLogRepository = new AuditLogRepository(AuditLog);
    const requestDumpRepository = new RequestDumpRepository(RequestDump);

    // services
    const auditService = new AuditService(auditLogRepository);
    const cryptoService = new CryptoService(env.jwtSecret, env.certificateSecret);
    const mailService = new MailService(env.smtp);
    const storageService = new CloudinaryService(env.cloudinary);
    const httpClient = new HttpClient(requestDumpRepository);
    const flutterwaveService = new FlutterwaveService(httpClient, env.flutterwave);
    const partnerPaymentService = new PartnerPaymentService(httpClient, env.partner);
    const paymentService = new PaymentService(
      transactionRepository,
      partnerTransactionRepository,
      flutterwaveService,
      partnerPaymentService,
      cryptoService
    );
    const authService = new AuthService(userRepository, applicationRepository, cryptoService, mailService);
    const adminService = new AdminService(adminRepository, cryptoService, mailService, auditService);
    const certificateService = new CertificateService(
      certificateRepository,
      counterRepository,
      applicationRepository,
      userRepository,
      paymentService,
      cryptoService,
      mailService,
      auditService,
      { verificationAmount: env.certificateAmount, apiUrl: env.apiUrl, frontendUrl: env.frontendUrl }
    );
    const applicationService = new ApplicationService(
      applicationRepository,
      userRepository,
      certificateService,
      paymentService,
      storageService,
      mailService,
      auditService,
      { applicationAmount: env.applicationAmount, apiUrl: env.apiUrl, frontendUrl: env.frontendUrl }
    );
    const signatoryService = new SignatoryService(signatoryRepository, storageService, auditService);
    const locationService = new LocationService();
    const webhookService = new WebhookService(
      partnerTransactionRepository,
      applicationRepository,
      certificateRepository,
      applicationService,
      certificateService
    );

    // middlewares
    const authMiddleware = new AuthMiddleware(cryptoService, userRepository, adminRepository);
    const webhookMiddleware = new WebhookMiddleware(env.partner.webhookSecret);
    const requestDumpMiddleware = new RequestDumpMiddleware(requestDumpRepository);

    // controllers
    const authController = new AuthController(authService);
    const adminController = new AdminController(adminService);
    const applicationController = new ApplicationController(applicationService);
    const certificateController = new CertificateController(certificateService);
    const signatoryController = new SignatoryController(signatoryService);
    const locationController = new LocationController(locationService);
    const partnerController = new PartnerController(webhookService, paymentService);
    const auditController = new AuditController(auditService);

    // routes
    const authRouter = new AuthRouter(authController, authMiddleware);
    const applicationRouter = new ApplicationRouter(applicationController, authMiddleware);
    const adminRouter = new AdminRouter(adminController, applicationController, auditController, authMiddleware);
    const certificateRouter = new CertificateRouter(certificateController, authMiddleware);
    const locationRouter = new LocationRouter(locationController);
    const signatoryRouter = new SignatoryRouter(signatoryController, authMiddleware);
    const partnerRouter = new PartnerRouter(
      partnerController,
      authMiddleware,
      webhookMiddleware,
      requestDumpMiddleware
    );

    this.instance.use(`${API_PREFIX}/auth`, authRouter.getRouter());
    this.instance.use(`${API_PREFIX}/application`, applicationRouter.getRouter());
    this.instance.use(`${API_PREFIX}/admin`, adminRouter.getRouter());
    this.instance.use(API_PREFIX, certificateRouter.getRouter());
    this.instance.use(API_PREFIX, locationRouter.getRouter());
    this.instance.use(`${API_PREFIX}/signatory`, signatoryRouter.getRouter());
    this.instance.use(`${API_PREFIX}/partner`, partnerRouter.getRouter());
  }

  private initialize404Handling(): void {
    this.instance.use((_req: Request, res: Response) => {
      res.status(404).json({ message: "NOT FOUND" });
    });
  }

  private initializeErrorHandling(): void {
    this.instance.use(this.errorMiddleware.handle);
  }
}

export default App;
