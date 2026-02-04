import deleteDatabaseController from "@/controllers/storage-service/Postgres/deleteDatabaseController";
import { StatusCode } from "@/types/types";

// Mock dependencies
const mockDropDatabase = jest.fn();
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
            dropDatabase: mockDropDatabase
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
    delete: jest.fn().mockReturnThis(),
};

jest.mock("@/db/client", () => ({
    db: mockDb
}));
jest.mock("@/db/schema", () => ({
    deployed_db: {}
}));
jest.mock("drizzle-orm", () => ({
    eq: jest.fn()
}));
jest.mock("@/utils/decryptPassword", () => jest.fn().mockReturnValue("decrypted"));

describe("deleteDatabaseController", () => {
    let mockSet: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
    });

    it("should delete database successfully", async () => {
        mockDb.where.mockResolvedValueOnce([{ id: 1, vpsId: 1, host: "1.2.3.4", dbName: "mydb" }]); // DB found
        (verifyMachine as jest.Mock).mockResolvedValue({
            status: true,
            machine: { vps_ip: "1.2.3.4", vps_password: "enc" }
        });

        const result = await deleteDatabaseController({ body: {}, params: { id: "1" }, userId: "1", set: mockSet } as any);

        expect(result).toMatchObject({ message: "Database deleted successfully" });
        expect(mockDropDatabase).toHaveBeenCalled();
        expect(mockDb.delete).toHaveBeenCalled();
    });

    it("should fail if database not found", async () => {
        mockDb.where.mockResolvedValueOnce([]); // Not found
        const result = await deleteDatabaseController({ body: {}, params: { id: "1" }, userId: "1", set: mockSet } as any);
        expect(result).toMatchObject({ message: "Database not found" });
        expect(mockSet.status).toBe(StatusCode.NOT_FOUND);
    });
});
