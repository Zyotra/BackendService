import backupMySQL from "@/controllers/storage-service/MySQL/backupMySQL";
import { StatusCode } from "@/types/types";

// Mock dependencies
const mockBackupDatabase = jest.fn();
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
        backupDatabase: mockBackupDatabase
    }));
});

// We need to mock verifyMachine which is imported from deployMySQL
jest.mock("@/controllers/storage-service/MySQL/deployMySQL", () => ({
    verifyMachine: jest.fn()
}));
import { verifyMachine } from "@/controllers/storage-service/MySQL/deployMySQL";

jest.mock("@/utils/decryptPassword", () => jest.fn().mockReturnValue("decrypted"));

describe("backupMySQL", () => {
    let mockSet: any;
    let mockBody: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
        mockBody = {
            username: "user",
            password: "pass",
            databaseName: "mydb",
            vpsId: "1",
            vpsIp: "1.2.3.4"
        };
    });

    it("should backup database successfully", async () => {
        (verifyMachine as jest.Mock).mockResolvedValue({
            status: true,
            machine: { vps_password: "enc" }
        });
        mockBackupDatabase.mockResolvedValue({ message: "Backup Done", backupPath: "/path/to/backup" });

        const result = await backupMySQL({ body: mockBody, userId: "1", set: mockSet } as any);

        expect(result).toMatchObject({ status: "success", backupPath: "/path/to/backup" });
        expect(mockSet.status).toBe(StatusCode.OK);
        expect(mockBackupDatabase).toHaveBeenCalled();
    });

    it("should fail if machine not found", async () => {
        (verifyMachine as jest.Mock).mockResolvedValue({ status: false, machine: null });
        const result = await backupMySQL({ body: mockBody, userId: "1", set: mockSet } as any);
        expect(result).toMatchObject({ status: "error", message: "VPS Machine not found" });
        expect(mockSet.status).toBe(StatusCode.NOT_FOUND);
    });
});
