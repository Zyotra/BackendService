import deployMySQL, { verifyMachine } from "@/controllers/storage-service/MySQL/deployMySQL";
import { StatusCode } from "@/types/types";

// Mock dependencies
const mockSetupMySQL = jest.fn();
const mockDropDatabase = jest.fn();
const mockConnect = jest.fn();
const mockClose = jest.fn();

jest.mock("@/SSHClient/SSHClient", () => {
    return jest.fn().mockImplementation(() => ({
        connect: mockConnect,
        close: mockClose
    }));
});

jest.mock("@/HelperClasses/mySQLHelper", () => {
    return jest.fn().mockImplementation(() => ({
        setupMySQL: mockSetupMySQL,
        dropDatabase: mockDropDatabase
    }));
});

const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn(),
    delete: jest.fn().mockReturnThis(),
};

jest.mock("@/db/client", () => ({
    db: mockDb
}));

jest.mock("@/db/schema", () => ({
    deployed_db: {},
    vpsMachines: { id: "id" }
}));

jest.mock("@/utils/decryptPassword", () => jest.fn().mockReturnValue("decrypted"));
jest.mock("drizzle-orm", () => ({
    eq: jest.fn(),
    and: jest.fn(),
}));

describe("deployMySQL", () => {
    let mockSet: any;
    let mockBody: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
        mockBody = {
            vpsId: "1",
            vpsIp: "1.2.3.4",
            dbName: "mydb",
            userName: "user",
            password: "pass",
            rootPassword: "root"
        };
    });

    // Test verifyMachine independently if possible, or implicitly
    // verifyMachine mocks db.select...

    it("should deploy mysql successfully", async () => {
        // Mock verifyMachine inside the module? 
        // It's hard to mock a function in the same module being tested unless we extract it.
        // But verifyMachine uses db.select, so we mock db.select to make verifyMachine pass.
        mockDb.where.mockResolvedValueOnce([{ id: 1, ownerId: 1, vps_ip: "1.2.3.4", vps_password: "enc" }]); // For verifyMachine call

        mockSetupMySQL.mockResolvedValue("MySQL Setup Success");

        const result = await deployMySQL({ body: mockBody, userId: "1", set: mockSet } as any);

        expect(result).toMatchObject({ message: "success", data: "MySQL Setup Success" });
        expect(mockSetupMySQL).toHaveBeenCalled();
        expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should fail if machine verification fails (invalid IP)", async () => {
        mockDb.where.mockResolvedValueOnce([{ id: 1, ownerId: 1, vps_ip: "5.6.7.8" }]); // Wrong IP

        const result = await deployMySQL({ body: mockBody, userId: "1", set: mockSet } as any);
        expect(result).toMatchObject({ message: "Unauthorized access for the machine" });
        expect(mockSet.status).toBe(StatusCode.FORBIDDEN);
    });

    it("should fail if unauthorized machine", async () => {
        mockDb.where.mockResolvedValueOnce([]); // No machine found for user
        const result = await deployMySQL({ body: mockBody, userId: "1", set: mockSet } as any);
        expect(result).toMatchObject({ message: "Unauthorized access for the machine" });
        expect(mockSet.status).toBe(StatusCode.FORBIDDEN);
    });
});
