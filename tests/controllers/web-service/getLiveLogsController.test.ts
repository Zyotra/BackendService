import getLiveLogsController from "@/controllers/web-service/getLiveLogsController";
import { StatusCode } from "@/types/types";

// Mock dependencies
const mockExecStream = jest.fn();
const mockConnect = jest.fn();
const mockClose = jest.fn();

jest.mock("@/SSHClient/SSHClient", () => {
    return jest.fn().mockImplementation(() => ({
        connect: mockConnect,
        execStream: mockExecStream,
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
    deployments: {},
    vpsMachines: {}
}));
jest.mock("drizzle-orm", () => ({
    eq: jest.fn(),
    and: jest.fn()
}));

jest.mock("@/utils/decryptPassword", () => jest.fn().mockReturnValue("decrypted"));
jest.mock("@/repoActions/getRepoName", () => jest.fn().mockReturnValue("repo"));

describe("getLiveLogsController", () => {
    let mockSet: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0, headers: {} };
    });

    it("should initiate log stream", async () => {
        mockDb.where
            .mockResolvedValueOnce([{ vpsIp: "1.2.3.4", repoUrl: "url" }]) // Project
            .mockResolvedValueOnce([{ vps_ip: "1.2.3.4", vps_password: "enc" }]); // VPS

        // Mock execStream to simulate stream setup
        mockExecStream.mockImplementation((cmd, callbacks) => {
            if (callbacks.onStdout) callbacks.onStdout("log line");
            if (callbacks.onClose) callbacks.onClose();
            return Promise.resolve();
        });

        const result = await getLiveLogsController({ params: { id: "dep1" }, userId: "1", set: mockSet } as any);

        expect(result).toBeInstanceOf(ReadableStream);
        expect(mockSet.headers['Content-Type']).toBe("text/event-stream");
    });

    it("should fail if project not found", async () => {
        mockDb.where.mockResolvedValueOnce([]); // Project not found
        const result = await getLiveLogsController({ params: { id: "dep1" }, userId: "1", set: mockSet } as any);
        expect(result).toMatchObject({ message: "Project not found" });
        expect(mockSet.status).toBe(StatusCode.NOT_FOUND);
    });
});
