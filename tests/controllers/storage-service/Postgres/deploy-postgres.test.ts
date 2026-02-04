import deployPostgresController from "@/controllers/storage-service/Postgres/deploy-postgres";
import { StatusCode } from "@/types/types";

// Mock dependencies
const mockInstall = jest.fn();
const mockStart = jest.fn();
const mockCreateUserAndDatabase = jest.fn();
const mockAllowRemoteConnections = jest.fn();
const mockConnect = jest.fn();
const mockClose = jest.fn();

jest.mock("@/SSHClient/SSHClient", () => {
    return jest.fn().mockImplementation(() => ({
        connect: mockConnect,
        close: mockClose
    }));
});

jest.mock("@/HelperClasses/PostgresHelper", () => {
    return {
        PostgresSSHHelper: jest.fn().mockImplementation(() => ({
            install: mockInstall,
            start: mockStart,
            createUserAndDatabase: mockCreateUserAndDatabase,
            allowRemoteConnections: mockAllowRemoteConnections,
            dropDatabase: jest.fn()
        }))
    };
});

jest.mock("@/controllers/storage-service/MySQL/deployMySQL", () => ({
    verifyMachine: jest.fn()
}));
import { verifyMachine } from "@/controllers/storage-service/MySQL/deployMySQL";

const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn(),
};

jest.mock("@/db/client", () => ({
    db: mockDb
}));
jest.mock("@/db/schema", () => ({
    deployed_db: {},
    vpsMachines: {}
}));
jest.mock("drizzle-orm", () => ({
    eq: jest.fn(),
    and: jest.fn()
}));
jest.mock("@/utils/decryptPassword", () => jest.fn().mockReturnValue("decrypted"));

describe("deployPostgresController", () => {
    let mockSet: any;
    let mockBody: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
        mockBody = {
            userName: "user",
            password: "pass",
            dbName: "mydb",
            vpsId: "1",
            vpsIp: "1.2.3.4"
        };
    });

    it("should deploy postgres successfully", async () => {
        (verifyMachine as jest.Mock).mockResolvedValue({
            status: true,
            machine: { vps_ip: "1.2.3.4", vps_password: "enc" }
        });
        mockDb.where.mockResolvedValueOnce([]); // No existing db

        const result = await deployPostgresController({ body: mockBody, userId: "1", set: mockSet } as any);

        expect(result).toMatchObject({ message: "Postgres deployment started successfully" });
        expect(mockSet.status).toBe(StatusCode.OK);
        expect(mockInstall).toHaveBeenCalled();
        expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should fail if database exists", async () => {
        (verifyMachine as jest.Mock).mockResolvedValue({ status: true, machine: { vps_ip: "1.2.3.4" } });
        mockDb.where.mockResolvedValueOnce([{ id: 1 }]); // Exists

        const result = await deployPostgresController({ body: mockBody, userId: "1", set: mockSet } as any);
        expect(result).toMatchObject({ message: "Database with this name already exists on this machine" });
        expect(mockSet.status).toBe(StatusCode.BAD_REQUEST);
    });
});
