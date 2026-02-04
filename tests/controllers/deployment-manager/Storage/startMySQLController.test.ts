import startMySQLController from "@/controllers/deployment-manager/Storage/startMySQLController";
import { StatusCode } from "@/types/types";

// Mock dependencies
const mockRunSequential = jest.fn();
const mockClose = jest.fn();

jest.mock("@/SSHClient/SSHClient", () => {
    return jest.fn().mockImplementation(() => ({
        runSequential: mockRunSequential,
        close: mockClose
    }));
});

const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn(),
};

jest.mock("@/db/client", () => ({
    db: mockDb
}));

jest.mock("@/db/schema", () => ({
    vpsMachines: {}
}));

jest.mock("@/crypto/decryptVpsPassword", () => jest.fn().mockReturnValue("decrypted"));
jest.mock("drizzle-orm", () => ({
    eq: jest.fn(),
    and: jest.fn(),
}));

describe("startMySQLController", () => {
    let mockSet: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
    });

    it("should start mysql successfully", async () => {
        mockDb.where.mockResolvedValue([{ id: 1, vps_ip: "1.2.3.4", vps_password: "enc" }]);

        await startMySQLController({ params: { id: "1" }, userId: "1", set: mockSet } as any);

        expect(mockRunSequential).toHaveBeenCalledWith(expect.arrayContaining(["sudo systemctl start mysql"]));
        // The controller doesn't return a body on success in the try block? 
        // Checking code: it just awaits runSequential. If no return, it returns undefined.
        // Wait, line 35 `await ssh.runSequential(startMysql)`. No return statement after that.
        // So it returns undefined. 
        expect(mockSet.status).toBe(undefined); // Status not explicitly set to OK in code provided? 
        // Checking code: `set.status ` is NOT set to OK in success.
    });

    it("should fail if VPS not found", async () => {
        mockDb.where.mockResolvedValue([]);
        const result = await startMySQLController({ params: { id: "1" }, userId: "1", set: mockSet } as any);
        expect(result).toMatchObject({ message: "Invalid machine details or unauthorized machine selected." });
        expect(mockSet.status).toBe(StatusCode.NOT_FOUND);
    });
});
