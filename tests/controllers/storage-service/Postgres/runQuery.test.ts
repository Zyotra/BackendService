import runQuery from "@/controllers/storage-service/Postgres/runQuery";
import { StatusCode } from "@/types/types";

// Mock dependencies
const mockExecuteSql = jest.fn();
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
            executeSql: mockExecuteSql
        }))
    };
});

jest.mock("@/controllers/storage-service/MySQL/deployMySQL", () => ({
    verifyMachine: jest.fn()
}));
import { verifyMachine } from "@/controllers/storage-service/MySQL/deployMySQL";
jest.mock("@/utils/decryptPassword", () => jest.fn().mockReturnValue("decrypted"));

describe("runQuery (Postgres)", () => {
    let mockSet: any;
    let mockBody: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
        mockBody = { databaseName: "db", query: "SELECT", vpsId: "1", vpsIp: "1.2.3.4", username: "user" };
    });

    it("should execute sql query", async () => {
        (verifyMachine as jest.Mock).mockResolvedValue({
            status: true,
            machine: { vps_ip: "1.2.3.4", vps_password: "enc" }
        });
        mockExecuteSql.mockResolvedValue([{ id: 1 }]);

        const result = await runQuery({ body: mockBody, userId: "1", set: mockSet } as any);

        expect(result).toMatchObject({ message: "success", rows: [{ id: 1 }] });
        expect(mockSet.status).toBe(StatusCode.OK);
    });
});
