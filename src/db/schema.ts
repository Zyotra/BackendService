 import { sql } from "drizzle-orm";
import { integer,pgTable,serial,text,timestamp,varchar } from "drizzle-orm/pg-core";


 export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const login_Sessions = pgTable("login_sessions", {
  id: serial("id").primaryKey(),
  userId: serial("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  refreshToken: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const otps= pgTable("otps", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  otp: varchar("otp", { length: 10 }).notNull(),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at")
    .default(sql`now() + interval '2 minute'`)
    .notNull(),
});

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

export const deployed_db=pgTable("deployed_db",{
    id:serial("id").primaryKey(),
    dbName:varchar("db_name").notNull(),
    username:varchar("username").notNull(),
    password:varchar("password").notNull(),
    host:varchar("host").notNull(),
    dbType:varchar("db_type").notNull(),
    vpsId:integer("vps_id").notNull(),
    userId:integer("user_id").notNull(),
    status:varchar("status").notNull(),
    createdAt:timestamp("created_at").defaultNow().notNull()
})

export const caching=pgTable("caching",{
    id:serial("id").primaryKey(),
    cacheName:varchar("cache_name").notNull(),
    password:varchar("password").notNull(),
    host:varchar("host").notNull(),
    vpsId:integer("vps_id").notNull(),
    userId:integer("user_id").notNull(),
    port:integer("port").notNull().unique(),
    cachingType:varchar("caching_type").default("redis"),
    status:varchar("status").notNull().default("running"),
    createdAt:timestamp("created_at").defaultNow().notNull()
})

export const vpsMachines = pgTable("vps_machines", {
    id: serial("id").primaryKey(),
    vps_ip: varchar("vps_ip", { length: 100 }).notNull(),
    vps_name: varchar("vps_name", { length: 100 }).notNull(),
    vps_password: text("vps_password").notNull(),
    ownerId: integer("ownerId").notNull(),
    ssh_key: text("ssh_key"),
    ram: integer("ram").notNull(),
    storage: integer("storage").notNull(),
    cpu_cores: integer("cpu_cores").notNull(),
    expiryDate: timestamp("expiry_date").notNull(),
    added_at: timestamp("added_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull()
})

export const userDomains=pgTable("user_domains",{
    id:serial("id").primaryKey(),
    domain_address:varchar("domain_address",{length:255}).notNull(),
    vps_ip:varchar("vps_ip",{length:100}).notNull(),
    ownerId:integer("owner").notNull(),
    isDeployed:integer("is_deployed").default(0).notNull(),
    added_at: timestamp("added_at").defaultNow().notNull()
});

export const githubAuths=pgTable("github_auths",{
    id:serial("id").primaryKey(),
    vpsId:integer("vps_id").notNull(),
    github_username:varchar("github_username",{length:100}).notNull(),
    added_at: timestamp("added_at").defaultNow().notNull()
});