import startNewRedis from "@/controllers/storage-service/Redis/startNewRedis";
import { StatusCode } from "@/types/types";

// Mock dependencies
const mockInstallRedisCLI = jest.fn();
const mockStartNewRedisServer = jest.fn();
const mockConnect = jest.fn();
const mockClose = jest.fn();

jest.mock("@/SSHClient/SSHClient", () => {
    return jest.fn().mockImplementation(() => ({
        connect: mockConnect,
        close: mockClose
    }));
});

jest.mock("@/HelperClasses/RedisHelper", () => {
    return jest.fn().mockImplementation(() => ({
        installRedisCLI: mockInstallRedisCLI,
        startNewRedisServer: mockStartNewRedisServer
    }));
});

jest.mock("@/controllers/storage-service/MySQL/deployMySQL", () => ({
    verifyMachine: jest.fn()
}));
import { verifyMachine } from "@/controllers/storage-service/MySQL/deployMySQL";

const mockDb = {
    insert: jest.fn().mockReturnThis(),
    values: jest.fn()
};

jest.mock("@/db/client", () => ({
    db: mockDb
}));
jest.mock("@/db/schema", () => ({
    caching: {}
}));
jest.mock("drizzle-orm", () => ({
    eq: jest.fn(),
    and: jest.fn()
}));
jest.mock("@/utils/decryptPassword", () => jest.fn().mockReturnValue("decrypted"));

describe("startNewRedis", () => {
    let mockSet: any;
    let mockBody: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
        mockBody = { name: "redis", password: "pass", vpsId: "1", vpsIp: "1.2.3.4", port: "6379" };
    });

    it("should deploy new redis server", async () => {
        (verifyMachine as jest.Mock).mockResolvedValue({
            status: true,
            machine: { vps_ip: "1.2.3.4", vps_password: "enc" }
        });

        const result = await startNewRedis({ body: mockBody, userId: "1", set: mockSet } as any);

        expect(result).toMatchObject({ message: "successully created new redis server" });
        expect(mockSet.status).toBe(StatusCode.OK);
        expect(mockInstallRedisCLI).toHaveBeenCalled();
        expect(mockStartNewRedisServer).toHaveBeenCalled();
        expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should fail if unauthorized", async () => {
        (verifyMachine as jest.Mock).mockResolvedValue({ status: false });
        const result = await startNewRedis({ body: mockBody, userId: "1", set: mockSet } as any);
        expect(result).toMatchObject({ message: "unauthorized machine access" });
        expect(mockSet.status).toBe(StatusCode.BAD_REQUEST);
    });
});
