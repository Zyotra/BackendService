import getLiveFrontendLogsController from "@/controllers/web-service/getFrontendLiveLogsController";
import { StatusCode } from "@/types/types";

// Mock dependencies
const mockExec = jest.fn();
const mockConnect = jest.fn();
const mockClose = jest.fn();

jest.mock("@/SSHClient/SSHClient", () => {
    return jest.fn().mockImplementation(() => ({
        connect: mockConnect,
        exec: mockExec,
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

describe("getFrontendLiveLogsController", () => {
    let mockSet: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
    });

    it("should return frontend live logs", async () => {
        mockDb.where
            .mockResolvedValueOnce([{ vpsIp: "1.2.3.4", repoUrl: "http://git/repo.git" }]) // Project found
            .mockResolvedValueOnce([{ vps_ip: "1.2.3.4", vps_password: "enc" }]); // VPS found

        mockExec.mockResolvedValue({ output: "Log content" });

        const result = await getLiveFrontendLogsController({ params: { id: "deploy1" }, userId: "1", set: mockSet } as any);

        expect(result).toMatchObject({ message: "Frontend live logs fetched successfully", errorLog: "Log content", accessLog: "Log content" });
        expect(mockSet.status).toBe(StatusCode.OK);
        // Should be called twice, for error and access logs
        expect(mockExec).toHaveBeenCalledTimes(2);
    });

    it("should fail if VPS not found", async () => {
        mockDb.where
            .mockResolvedValueOnce([{ vpsIp: "1.2.3.4" }])
            .mockResolvedValueOnce([]); // VPS Not found

        const result = await getLiveFrontendLogsController({ params: { id: "deploy1" }, userId: "1", set: mockSet } as any);
        expect(result).toMatchObject({ message: "VPS Machine not found" });
        expect(mockSet.status).toBe(StatusCode.NOT_FOUND);
    });
});
