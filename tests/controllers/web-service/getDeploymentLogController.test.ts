import getDeploymentLogController from "@/controllers/web-service/getDeploymentLogController";
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

describe("getDeploymentLogController", () => {
    let mockSet: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
    });

    it("should return deployment logs", async () => {
        mockDb.where
            .mockResolvedValueOnce([{ vpsIp: "1.2.3.4" }]) // Project found
            .mockResolvedValueOnce([{ vps_ip: "1.2.3.4", vps_password: "enc" }]); // VPS found

        mockExec.mockResolvedValue({ output: "Build logs..." });

        const result = await getDeploymentLogController({ params: { id: "deploy1" }, userId: "1", set: mockSet } as any);

        expect(result).toMatchObject({ message: "success", log: "Build logs..." });
        expect(mockSet.status).toBe(StatusCode.OK);
        expect(mockExec).toHaveBeenCalledWith(expect.stringContaining("cat $HOME/logs/webservice-logs/deploy1.log"));
    });

    it("should fail if project not found", async () => {
        mockDb.where.mockResolvedValueOnce([]); // Project not found
        const result = await getDeploymentLogController({ params: { id: "deploy1" }, userId: "1", set: mockSet } as any);
        expect(result).toMatchObject({ message: "Project not found" });
        expect(mockSet.status).toBe(StatusCode.NOT_FOUND);
    });
});
