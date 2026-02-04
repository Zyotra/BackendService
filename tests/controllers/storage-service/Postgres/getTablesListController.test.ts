import getTablesListController from "@/controllers/storage-service/Postgres/getTablesListController";
import { StatusCode } from "@/types/types";

// Mock dependencies
const mockGetTablesList = jest.fn();
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
            getTablesList: mockGetTablesList
        }))
    };
});

jest.mock("@/utils/parseTableNames", () => jest.fn().mockReturnValue(["table1"]));

jest.mock("@/controllers/storage-service/MySQL/deployMySQL", () => ({
    verifyMachine: jest.fn()
}));
import { verifyMachine } from "@/controllers/storage-service/MySQL/deployMySQL";
jest.mock("@/utils/decryptPassword", () => jest.fn().mockReturnValue("decrypted"));

describe("getTablesListController", () => {
    let mockSet: any;
    let mockBody: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
        mockBody = { databaseName: "db", vpsId: "1", vpsIp: "1.2.3.4", username: "user" };
    });

    it("should return tables list", async () => {
        (verifyMachine as jest.Mock).mockResolvedValue({
            status: true,
            machine: { vps_ip: "1.2.3.4", vps_password: "enc" }
        });
        mockGetTablesList.mockResolvedValue("raw table data");

        const result = await getTablesListController({ body: mockBody, userId: "1", set: mockSet } as any);

        expect(result).toMatchObject({ status: StatusCode.OK, data: ["table1"] });
        expect(mockSet.status).toBe(StatusCode.OK);
    });
});
