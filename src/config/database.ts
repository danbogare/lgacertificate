import mongoose from "mongoose";
import { env } from "./env";

class DatabaseManager {
  private static instance: DatabaseManager;

  private constructor() {
    this.registerEventListeners();
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  private registerEventListeners(): void {
    mongoose.connection.on("connected", () => {
      console.log("MongoDB connected successfully.");
    });

    mongoose.connection.on("error", (error) => {
      console.error(`MongoDB connection error: ${error}`);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB disconnected.");
    });
  }

  public async connect(): Promise<void> {
    await mongoose.connect(env.mongoUri);
  }

  public async disconnect(): Promise<void> {
    try {
      await mongoose.disconnect();
    } catch (error) {
      console.error("Error during MongoDB disconnection:", error);
    }
  }
}

export const dbManager = DatabaseManager.getInstance();
