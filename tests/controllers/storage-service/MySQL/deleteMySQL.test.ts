import deleteMySQL from "@/controllers/storage-service/MySQL/deleteMySQL";
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

jest.mock("@/HelperClasses/mySQLHelper", () => {
    return jest.fn().mockImplementation(() => ({
        dropDatabase: mockDropDatabase
    }));
});

jest.mock("@/controllers/storage-service/MySQL/deployMySQL", () => ({
    verifyMachine: jest.fn()
}));
import { verifyMachine } from "@/controllers/storage-service/MySQL/deployMySQL";

const mockDb = {
    delete: jest.fn().mockReturnThis(),
    where: jest.fn(),
};

jest.mock("@/db/client", () => ({
    db: mockDb
}));
jest.mock("@/db/schema", () => ({
    deployed_db: {}
}));

jest.mock("@/utils/decryptPassword", () => jest.fn().mockReturnValue("decrypted"));
jest.mock("drizzle-orm", () => ({
    eq: jest.fn(),
    and: jest.fn(),
}));

describe("deleteMySQL", () => {
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

    it("should delete database successfully", async () => {
        (verifyMachine as jest.Mock).mockResolvedValue({
            status: true,
            machine: { vps_password: "enc" }
        });

        const result = await deleteMySQL({ body: mockBody, userId: "1", set: mockSet } as any);

        expect(result).toMatchObject({ status: "success", message: "Database deleted succesfully" });
        expect(mockSet.status).toBe(StatusCode.OK);
        expect(mockDropDatabase).toHaveBeenCalled();
        expect(mockDb.delete).toHaveBeenCalled();
    });

    it("should fail if unauthorized", async () => {
        (verifyMachine as jest.Mock).mockResolvedValue({ status: false });
        const result = await deleteMySQL({ body: mockBody, userId: "1", set: mockSet } as any);
        expect(result).toMatchObject({ message: "Unauthorized access for the machine" });
        expect(mockSet.status).toBe(StatusCode.FORBIDDEN);
    });
});
