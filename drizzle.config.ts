import {defineConfig} from "drizzle-kit"

export default defineConfig({
    schema: "./src/db/schema.ts",
    dialect: "postgresql",
    dbCredentials:{
        url: process.env.DEPLOY_DATABASE_URL as string
    }
})