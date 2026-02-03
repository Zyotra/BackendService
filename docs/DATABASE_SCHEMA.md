# Database Schema Documentation

The system uses **PostgreSQL** managed via **Drizzle ORM**.
Schema Definition File: `src/db/schema.ts`

## Tables

### 1. `users`
Core identity table.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL | PK | Unique User ID |
| `name` | VARCHAR(255) | NOT NULL | Display name |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Login email |
| `password` | TEXT | NOT NULL | Hashed password (Bcrypt) |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Registration time |

### 2. `login_sessions`
Manages refresh tokens.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL | PK | Session ID |
| `user_id` | INTEGER | FK -> users.id | Cascade delete |
| `token` | TEXT | UNIQUE, NOT NULL | Refresh Token |
| `expires_at` | TIMESTAMP | NOT NULL | Token expiration |

### 3. `vps_machines`
Stores user infrastructure (Servers).
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL | PK | Internal Machine ID |
| `vps_ip` | VARCHAR(100) | NOT NULL | Public IP address |
| `vps_name` | VARCHAR(100) | NOT NULL | User-friendly alias |
| `vps_password` | TEXT | NOT NULL | **Encrypted** (AES) SSH Password |
| `ownerId` | INTEGER | NOT NULL | FK (Logical) -> users.id |
| `ssh_key` | TEXT | NULLABLE | Optional PEM private key |

### 4. `deployments`
Tracks active application deployments.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL | PK | Internal ID |
| `deploymentId`| VARCHAR(100)| NOT NULL | Public/WebSocket ID (e.g. `dep_...`) |
| `ownerId` | INTEGER | NOT NULL | FK (Logical) -> users.id |
| `vpsIp` | VARCHAR | NOT NULL | Target Server IP |
| `repoUrl` | TEXT | NOT NULL | Source Git URL |
| `domain` | VARCHAR(255)| NOT NULL | Bound Domain Name |
| `framework` | VARCHAR(100)| NOT NULL | node, react, python, etc. |
| `serverFilePath`| TEXT | DEFAULT "" | Entry point (e.g. `dist/index.js`) |
| `status` | VARCHAR(50) | NOT NULL | SUCCESS, FAILED, PENDING |

### 5. `user_domains`
Global registry of domains to prevent conflicts.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL | PK | |
| `domain_address`| VARCHAR(255)| NOT NULL | The domain name |
| `owner` | INTEGER | NOT NULL | FK -> users.id |
| `is_deployed` | INTEGER | DEFAULT 0 | 1 = Active, 0 = Available |
| `vps_ip` | VARCHAR | NOT NULL | Where it points to |

### 6. `deployed_db`
Tracks managed database instances.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL | PK | |
| `dbName` | VARCHAR | NOT NULL | Database Name |
| `username` | VARCHAR | NOT NULL | DB User |
| `password` | VARCHAR | NOT NULL | DB Password |
| `dbType` | VARCHAR | NOT NULL | postgres, mysql |
| `vpsId` | INTEGER | NOT NULL | Host machine ID |

### 7. `otps`
Temporary One-Time Passwords.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `email` | VARCHAR | NOT NULL | |
| `otp` | VARCHAR(10) | NOT NULL | Code |
| `expires_at` | TIMESTAMP | DEFAULT +2m | Short expiration |

## Relationships & Logical Constraints

1.  **User Ownership**:
    - `users` 1 : N `vps_machines` (via `ownerId`)
    - `users` 1 : N `deployments` (via `ownerId`)
    - `users` 1 : N `deployed_db` (via `user_id`)

2.  **Machine Hosting**:
    - `vps_machines` 1 : N `deployments` (Implicit via `vpsIp`)
    - `vps_machines` 1 : N `deployed_db` (via `vpsId`)

3.  **Domain Uniqueness**:
    - A `domain` in `deployments` must verify against `user_domains`.
    - `user_domains` ensures no two users claim the same domain.

## Notes
- **Drizzle ORM** manages types logic, but many foreign keys (like `ownerId`) are logical integer references rather than strict SQL `FOREIGN KEY` constraints in some tables (e.g., `vps_machines` uses `integer("ownerId")` without `.references()`).
- **Security**: Sensitive fields (`vps_password`) are encrypted at the application level before insertion.
