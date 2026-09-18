import dotenv from "dotenv";
dotenv.config();

export const config = {
    database: {
        DB: process.env.MONGO_URI,
    },
    app: {
        NAME: process.env.APP_NAME,
        URL: process.env.APP_URL,
        PORT: Number(process.env.PORT),
        JWT_SECRET: process.env.JWT_SECRET,
        ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET,
        FRONT_END_URL: process.env.FRONT_END_URL,
        APPLICATION_AMOUNT: 10000,
        CERTIFICATE_AMOUNT: 500,
        ADMIN_EMAIL: process.env.APP_ADMIN_EMAIL,
        ADMIN_PASS: process.env.APP_ADMIN_PASSWORD,
        ADMIN_NAME: process.env.APP_ADMIN_NAME,
    },
    mail: {
        HOST: process.env.SMTP_HOST,
        USER_EMAIL: process.env.SMTP_USER_EMAIL,
        USER_PASSWORD: process.env.SMTP_PASSWORD,
        PORT: 465,
        FROM_NAME: process.env.SMTP_FROM_NAME,
    },
    cloudinary: {
        NAME: process.env.CLOUDINARY_CLOUD_NAME,
        API_KEY: process.env.CLOUDINARY_API_KEY,
        API_SECRET: process.env.CLOUDINARY_API_SECRET,
    },
    payments: {
        URI: process.env.FLW_URI,
        SECRET: process.env.FLW_SECRET,
        KEY: process.env.FLW_KEY
    }
}