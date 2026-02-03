import { build } from "bun";
import { integer,pgTable,serial,text,timestamp,varchar } from "drizzle-orm/pg-core";

export const deployments=pgTable("deployments",{
    id:serial("id").primaryKey(),
    vpsIp:varchar("vps_ip").notNull(),
    ownerId:integer("owner_id").notNull(),
    repoUrl:text("repo_url").notNull(),
    domain:varchar("domain",{length:255}).notNull(),
    logs:text("logs"),
    deploymentId:varchar("deployment_id",{length:100}).notNull(),
    framework:varchar("framework",{length:100}).notNull(),
    projectType:varchar("project_type",{length:100}).notNull(),
    subFolder:varchar("sub_folder",{length:50}).default(""),
    buildCommand:text("build_command").default(""),
    serverFilePath:text("server_file_path").default(""),
    packageInstallerCommand:text("package_installer_command").default(""),
    status:varchar("status",{length:50}).notNull(),
    createdAt:timestamp("created_at").defaultNow().notNull(),
});

export const activityLogs=pgTable("activity_logs",{
    id:serial("id").primaryKey(),
    deploymentId:varchar("deployment_id",{length:100}).notNull(),
    userId:integer("user_id").notNull(),
    domain_address:varchar("domain_address",{length:255}).notNull(),
    log:text("log").notNull(),
    createdAt:timestamp("created_at").defaultNow().notNull(),
});