import App from "./app";
import { env } from "./config/env";
import { dbManager } from "./config/database";
import { Admin } from "./models/admin.model";
import { AdminRepository } from "./repositories/admin.repository";
import { CryptoService } from "./services/crypto.service";
import { seedSuperAdmin } from "./seeders/super-admin.seeder";

async function bootstrap() {
  try {
    // Connect first so the server never accepts requests without a database
    await dbManager.connect();

    await seedSuperAdmin(
      new AdminRepository(Admin),
      new CryptoService(env.jwtSecret, env.certificateSecret),
      env.superAdmin
    );

    const app = new App();

    const server = app.instance.listen(env.port, () => {
      console.log(`Server running on port ${env.port} in ${env.nodeEnv} mode`);
    });

    const shutdown = (signal: string) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);

      server.close(async () => {
        await dbManager.disconnect();
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

bootstrap();
