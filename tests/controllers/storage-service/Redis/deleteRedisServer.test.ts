import deleteRedisServer from "@/controllers/storage-service/Redis/deleteRedisServer";
import { StatusCode } from "@/types/types";

// Mock dependencies
const mockDeleteRedisServer = jest.fn();
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
        deleteRedisServer: mockDeleteRedisServer
    }));
});

jest.mock("@/controllers/storage-service/MySQL/deployMySQL", () => ({
    verifyMachine: jest.fn()
}));
import { verifyMachine } from "@/controllers/storage-service/MySQL/deployMySQL";

const mockDb = {
    delete: jest.fn().mockReturnThis(),
    where: jest.fn()
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

describe("deleteRedisServer", () => {
    let mockSet: any;
    let mockBody: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
        mockBody = { name: "redis", password: "pass", vpsId: "1", vpsIp: "1.2.3.4", port: "6379" };
    });

    it("should delete redis server", async () => {
        (verifyMachine as jest.Mock).mockResolvedValue({
            status: true,
            machine: { vps_ip: "1.2.3.4", vps_password: "enc" }
        });
        mockDeleteRedisServer.mockResolvedValue("Deleted");

        const result = await deleteRedisServer({ body: mockBody, userId: "1", set: mockSet } as any);

        expect(result).toMatchObject({ message: "successully deleted redis server" });
        expect(mockSet.status).toBe(StatusCode.OK);
        expect(mockDb.delete).toHaveBeenCalled();
    });

    it("should fail if unauthorized", async () => {
        (verifyMachine as jest.Mock).mockResolvedValue({ status: false });
        const result = await deleteRedisServer({ body: mockBody, userId: "1", set: mockSet } as any);
        expect(result).toMatchObject({ message: "unauthorized machine access" });
        expect(mockSet.status).toBe(StatusCode.BAD_REQUEST);
    });
});
